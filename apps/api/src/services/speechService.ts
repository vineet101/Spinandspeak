import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { AnalyseSpeechMetadata, AnalyseSpeechResponse } from "@spin-and-speak/api-types";
import type {
  ArticulationIssue,
  DeliveryScores,
  IssueTag,
  ScoringResult,
  SpeechMetrics,
  TimeManagement
} from "@spin-and-speak/domain";
import { RUBRIC_VERSION } from "@spin-and-speak/domain";
import { assembleScoringResult, fillerComponentScore } from "@spin-and-speak/scoring";
import { config } from "../config.js";
import { convertAndMeasureAudio, type ObjectiveAudioMetrics } from "./audioMetrics.js";
import { getOpenAI } from "./openaiClient.js";

interface AudioObservations {
  validAudio: boolean;
  validityReason: string;
  anotherSpeakerDominant: boolean;
  backgroundNoiseSevere: boolean;
  volumeAssessment: "too_soft" | "good" | "too_loud";
  pitchVariation: "low" | "good" | "high";
  paceAssessment: "too_slow" | "good" | "too_fast";
  pausingAndEmphasis: "weak" | "good" | "strong";
  audienceEngagement: "low" | "good" | "high";
  rushedAtEnd: boolean;
  unfinishedAtEnd: boolean;
  restartCount: number;
  articulationIssues: ArticulationIssue[];
  articulationConfidence: number;
  deliveryConfidence: number;
}

interface RawEvaluation {
  structure: ScoringResult["structure"];
  content: ScoringResult["content"];
  clarity: ScoringResult["clarity"];
  fluency: ScoringResult["fluency"];
  delivery: ScoringResult["delivery"];
  strengths: [string, string];
  improvements: [string, string];
  nextFocus: string;
  issueTags: IssueTag[];
  confidence: ScoringResult["confidence"];
}

function wordCount(text: string): number {
  return (text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) ?? []).length;
}

function countFillers(text: string): { count: number; breakdown: Record<string, number> } {
  const normalized = text.toLowerCase();
  const patterns: Array<[string, RegExp]> = [
    ["um", /\bum+\b/g],
    ["uh", /\buh+\b/g],
    ["erm", /\berm+\b/g],
    ["hmm", /\bhm+m*\b/g],
    ["you know", /\byou know\b/g],
    ["i mean", /\bi mean\b/g],
    ["like", /(?:^|[,;:.!?]\s+)like\b/g]
  ];
  const breakdown: Record<string, number> = {};
  let count = 0;
  for (const [name, regex] of patterns) {
    const matches = normalized.match(regex)?.length ?? 0;
    if (matches) breakdown[name] = matches;
    count += matches;
  }
  return { count, breakdown };
}

function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

async function transcribe(wav: Buffer): Promise<string> {
  const openai = getOpenAI();
  const temp = path.join(os.tmpdir(), `spin-speak-${crypto.randomUUID()}.wav`);
  try {
    await fs.writeFile(temp, wav);
    const result = await openai.audio.transcriptions.create({
      file: await import("node:fs").then((m) => m.createReadStream(temp)),
      model: config.TRANSCRIPTION_MODEL,
      prompt: "Transcribe verbatim. Preserve filler words such as um, uh, erm, hmm, 'you know', and 'I mean' when spoken. Do not clean up repetitions or false starts."
    });
    return result.text.trim();
  } finally {
    await fs.rm(temp, { force: true });
  }
}

async function analyseAudio(wav: Buffer, transcript: string): Promise<AudioObservations> {
  const openai = getOpenAI();
  const base64 = wav.toString("base64");
  const prompt = `You are analysing a child's 60-second impromptu speech for delivery and pronunciation. Do not judge idea quality or structure. Listen to the actual audio. Accent must not reduce the score if understandable. Be especially attentive to final consonants and word endings such as t, d, k, s, -ed and -s. Never invent a specific pronunciation example. Include a word only if you are genuinely confident it was unclear. Distinguish natural rhetorical pauses from being stuck. Assess whether another speaker dominates or severe background noise makes fair scoring impossible.\n\nTranscript for support only (audio is authoritative):\n${transcript}\n\nReturn ONLY JSON with this exact shape:\n{"validAudio":true,"validityReason":"","anotherSpeakerDominant":false,"backgroundNoiseSevere":false,"volumeAssessment":"good","pitchVariation":"good","paceAssessment":"good","pausingAndEmphasis":"good","audienceEngagement":"good","rushedAtEnd":false,"unfinishedAtEnd":false,"restartCount":0,"articulationIssues":[{"word":"best","issue":"final t was unclear","coachingTip":"Finish the last sound cleanly.","confidence":0.8}],"articulationConfidence":0.8,"deliveryConfidence":0.8}\nAllowed values must match the example enums. articulationIssues may be empty. confidence values are 0 to 1.`;

  const completion = await openai.chat.completions.create({
    model: config.AUDIO_MODEL,
    modalities: ["text", "audio"],
    audio: { voice: "alloy", format: "wav" },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: base64, format: "wav" } }
      ]
    }],
    store: false
  } as never);

  const content = completion.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Audio analysis returned no text content.");
  const raw = safeJson(content) as Partial<AudioObservations>;
  return {
    validAudio: raw.validAudio !== false,
    validityReason: typeof raw.validityReason === "string" ? raw.validityReason : "",
    anotherSpeakerDominant: raw.anotherSpeakerDominant === true,
    backgroundNoiseSevere: raw.backgroundNoiseSevere === true,
    volumeAssessment: ["too_soft", "good", "too_loud"].includes(String(raw.volumeAssessment)) ? raw.volumeAssessment as AudioObservations["volumeAssessment"] : "good",
    pitchVariation: ["low", "good", "high"].includes(String(raw.pitchVariation)) ? raw.pitchVariation as AudioObservations["pitchVariation"] : "good",
    paceAssessment: ["too_slow", "good", "too_fast"].includes(String(raw.paceAssessment)) ? raw.paceAssessment as AudioObservations["paceAssessment"] : "good",
    pausingAndEmphasis: ["weak", "good", "strong"].includes(String(raw.pausingAndEmphasis)) ? raw.pausingAndEmphasis as AudioObservations["pausingAndEmphasis"] : "good",
    audienceEngagement: ["low", "good", "high"].includes(String(raw.audienceEngagement)) ? raw.audienceEngagement as AudioObservations["audienceEngagement"] : "good",
    rushedAtEnd: raw.rushedAtEnd === true,
    unfinishedAtEnd: raw.unfinishedAtEnd === true,
    restartCount: Math.max(0, Math.min(30, Math.round(Number(raw.restartCount) || 0))),
    articulationIssues: Array.isArray(raw.articulationIssues) ? raw.articulationIssues.filter((x): x is ArticulationIssue => Boolean(x && typeof x.issue === "string" && typeof x.coachingTip === "string" && Number(x.confidence) >= 0.65)).slice(0, 3) : [],
    articulationConfidence: Math.max(0, Math.min(1, Number(raw.articulationConfidence) || 0.5)),
    deliveryConfidence: Math.max(0, Math.min(1, Number(raw.deliveryConfidence) || 0.5))
  };
}

function timeManagement(objective: ObjectiveAudioMetrics, audio: AudioObservations): TimeManagement {
  if (audio.unfinishedAtEnd && objective.speakingDurationSeconds >= 57) return "unfinished_at_60";
  if (objective.speakingDurationSeconds < 50) return "finished_too_early";
  return "good";
}

function buildMetrics(objective: ObjectiveAudioMetrics, transcript: string, audio: AudioObservations): SpeechMetrics {
  const fillers = countFillers(transcript);
  const speakingSeconds = Math.max(1, objective.speakingDurationSeconds);
  const wordsPerMinute = Math.round((wordCount(transcript) / speakingSeconds) * 60);
  return {
    fillerCount: fillers.count,
    fillerBreakdown: fillers.breakdown,
    longPauseCount: objective.longPauseCount,
    longPauseDurationSeconds: objective.longPauseDurationSeconds,
    restartCount: audio.restartCount,
    wordsPerMinute,
    speakingDurationSeconds: objective.speakingDurationSeconds,
    percentWindowSpoken: objective.percentWindowSpoken,
    relativeLoudnessDb: objective.relativeLoudnessDb,
    volumeAssessment: objective.volumeAssessment,
    pitchVariation: objective.pitchVariation === "low" || audio.pitchVariation === "low" ? "low" : objective.pitchVariation,
    pitchRangeSemitones: objective.pitchRangeSemitones,
    articulationIssues: audio.articulationIssues,
    timeManagement: timeManagement(objective, audio)
  };
}

const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    structure: {
      type: "object", additionalProperties: false,
      properties: { opening: { type: "number" }, logicalFlow: { type: "number" }, organisation: { type: "number" }, endingAndTimeManagement: { type: "number" } },
      required: ["opening", "logicalFlow", "organisation", "endingAndTimeManagement"]
    },
    content: {
      type: "object", additionalProperties: false,
      properties: { relevance: { type: "number" }, depth: { type: "number" }, examplesAndDetail: { type: "number" }, originality: { type: "number" } },
      required: ["relevance", "depth", "examplesAndDetail", "originality"]
    },
    clarity: {
      type: "object", additionalProperties: false,
      properties: { articulationAndEnunciation: { type: "number" }, sentenceClarity: { type: "number" }, intelligibility: { type: "number" } },
      required: ["articulationAndEnunciation", "sentenceClarity", "intelligibility"]
    },
    fluency: {
      type: "object", additionalProperties: false,
      properties: { fillerWords: { type: "number" }, unintendedPauses: { type: "number" }, restartsAndRepetitions: { type: "number" }, continuity: { type: "number" } },
      required: ["fillerWords", "unintendedPauses", "restartsAndRepetitions", "continuity"]
    },
    delivery: {
      type: "object", additionalProperties: false,
      properties: { volumeAndProjection: { type: "number" }, pitchAndTonality: { type: "number" }, pace: { type: "number" }, pausingAndEmphasis: { type: "number" }, audienceEngagement: { type: "number" } },
      required: ["volumeAndProjection", "pitchAndTonality", "pace", "pausingAndEmphasis", "audienceEngagement"]
    },
    strengths: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
    improvements: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
    nextFocus: { type: "string" },
    issueTags: { type: "array", uniqueItems: true, items: { type: "string", enum: ["too_many_fillers","long_pauses","too_many_restarts","low_continuity","low_volume","monotone_delivery","rushed_delivery","weak_opening","weak_ending","poor_time_management","ideas_not_developed","dropped_word_endings"] } },
    confidence: {
      type: "object", additionalProperties: false,
      properties: { overall: { type: "number" }, articulation: { type: "number" }, delivery: { type: "number" } },
      required: ["overall", "articulation", "delivery"]
    }
  },
  required: ["structure", "content", "clarity", "fluency", "delivery", "strengths", "improvements", "nextFocus", "issueTags", "confidence"]
} as const;

function clamp10(value: number): number { return Math.max(0, Math.min(10, Number(value) || 0)); }

function enforceDeterministicRules(raw: RawEvaluation, metrics: SpeechMetrics, audio: AudioObservations): RawEvaluation {
  const result: RawEvaluation = structuredClone(raw);
  const scoreGroups = [result.structure, result.content, result.clarity, result.fluency, result.delivery] as Array<Record<string, number>>;
  for (const group of scoreGroups) for (const key of Object.keys(group)) group[key] = clamp10(group[key] ?? 0);

  result.fluency.fillerWords = fillerComponentScore(metrics.fillerCount);
  if (metrics.longPauseCount >= 3) result.fluency.unintendedPauses = Math.min(result.fluency.unintendedPauses, 5);
  if (metrics.longPauseCount >= 5) result.fluency.unintendedPauses = Math.min(result.fluency.unintendedPauses, 3);
  if (metrics.speakingDurationSeconds < 20) result.fluency.continuity = Math.min(result.fluency.continuity, 3);
  else if (metrics.speakingDurationSeconds < 40) result.fluency.continuity = Math.min(result.fluency.continuity, 6);
  else if (metrics.speakingDurationSeconds < 50) result.fluency.continuity = Math.min(result.fluency.continuity, 8);

  if (metrics.volumeAssessment === "too_soft") result.delivery.volumeAndProjection = Math.min(result.delivery.volumeAndProjection, 6);
  if (metrics.volumeAssessment === "too_loud") result.delivery.volumeAndProjection = Math.min(result.delivery.volumeAndProjection, 7);
  if (metrics.pitchVariation === "low") result.delivery.pitchAndTonality = Math.min(result.delivery.pitchAndTonality, 6);
  if (audio.rushedAtEnd) result.delivery.pace = Math.min(result.delivery.pace, 7);

  if (metrics.timeManagement === "finished_too_early") result.structure.endingAndTimeManagement = Math.min(result.structure.endingAndTimeManagement, metrics.speakingDurationSeconds < 40 ? 5 : 7);
  if (metrics.timeManagement === "unfinished_at_60") result.structure.endingAndTimeManagement = Math.min(result.structure.endingAndTimeManagement, 6);

  const tags = new Set(result.issueTags);
  if (metrics.fillerCount >= 4) tags.add("too_many_fillers");
  if (metrics.longPauseCount >= 2) tags.add("long_pauses");
  if (metrics.restartCount >= 3) tags.add("too_many_restarts");
  if (metrics.speakingDurationSeconds < 45) tags.add("low_continuity");
  if (metrics.volumeAssessment === "too_soft") tags.add("low_volume");
  if (metrics.pitchVariation === "low") tags.add("monotone_delivery");
  if (audio.rushedAtEnd) tags.add("rushed_delivery");
  if (metrics.timeManagement !== "good") tags.add("poor_time_management");
  if (metrics.articulationIssues.length) tags.add("dropped_word_endings");
  result.issueTags = [...tags];
  return result;
}

async function evaluateSpeech(topic: string, level: number, transcript: string, metrics: SpeechMetrics, audio: AudioObservations, recentIssueTags: IssueTag[]): Promise<RawEvaluation> {
  const openai = getOpenAI();
  const response = await openai.responses.create({
    model: config.SCORING_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "developer",
        content: `Score a 60-second impromptu speech by a child aged 9-11. Categories must be assessed INDEPENDENTLY. Do not let overall impression leak across categories. Use 0-10 raw sub-scores; downstream code applies weights and rounds to 0.5. Difficulty level does not change the scoring standard.\n\nSTRUCTURE: Opening 20%, Logical flow 40%, Organisation 25%, Ending/time management 15%. Reward coherent organisation, not a rigid formula. Do not reward idea sophistication here. 55-60 sec with natural conclusion is ideal; 50-55 complete is acceptable; under 50 may be underdeveloped; mid-sentence at 60 hurts time management.\n\nCONTENT: Relevance 25%, Depth 30%, Examples/detail 25%, Originality/insight 20%. Judge development of ideas, not vocabulary, confidence or organisation.\n\nCLARITY: Articulation/enunciation 50%, Sentence clarity 25%, Intelligibility 25%. Accent is neutral if understandable. Do not penalize soft volume, fillers, or organisation here. Use actual-audio articulation observations supplied below.\n\nFLUENCY: Fillers 25%, Unintended pauses 25%, Restarts/repetitions 20%, Continuity 30%. Pauses for effect are not fluency errors. Do not diagnose stuttering.\n\nDELIVERY: Volume/projection 30%, Pitch/tonal variation 25%, Pace 20%, Pausing/emphasis 15%, Audience engagement 10%. Reward expressive controlled speaking, not shouting.\n\nFeedback must be child-friendly and concrete. Return exactly two strengths, exactly two improvements, and one single most important next focus. Only mention specific pronunciation words if present in supplied articulationIssues. Issue tags must reflect observable problems.`
      },
      {
        role: "user",
        content: JSON.stringify({ topic, level, transcript, metrics, audioObservations: audio, recentIssueTags })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "speech_evaluation",
        strict: true,
        schema: evaluationSchema
      }
    }
  });
  return JSON.parse(response.output_text) as RawEvaluation;
}

function mockEvaluation(metrics: SpeechMetrics): RawEvaluation {
  const base = metrics.speakingDurationSeconds >= 50 ? 7.5 : metrics.speakingDurationSeconds >= 35 ? 6.5 : 5;
  return {
    structure: { opening: base, logicalFlow: base, organisation: base + 0.5, endingAndTimeManagement: metrics.timeManagement === "good" ? base + 0.5 : base - 1 },
    content: { relevance: base + 0.5, depth: base, examplesAndDetail: base - 0.5, originality: base },
    clarity: { articulationAndEnunciation: base + 0.5, sentenceClarity: base + 0.5, intelligibility: base + 1 },
    fluency: { fillerWords: fillerComponentScore(metrics.fillerCount), unintendedPauses: base, restartsAndRepetitions: base, continuity: base },
    delivery: { volumeAndProjection: metrics.volumeAssessment === "too_soft" ? 5.5 : base, pitchAndTonality: metrics.pitchVariation === "low" ? 5.5 : base, pace: base, pausingAndEmphasis: base, audienceEngagement: base },
    strengths: ["You stayed focused on the topic.", "Your ideas were easy to follow."],
    improvements: [metrics.fillerCount >= 4 ? "Try replacing filler words with a short silent pause." : "Add one more specific example to develop your idea.", metrics.volumeAssessment === "too_soft" ? "Project your voice so someone across the room can hear you." : "Use more changes in tone to keep the listener engaged."],
    nextFocus: metrics.volumeAssessment === "too_soft" ? "Speak one level louder from your very first sentence." : "Choose one idea and support it with a clear example.",
    issueTags: [],
    confidence: { overall: 0.8, articulation: 0.75, delivery: 0.8 }
  };
}

function mockAudio(objective: ObjectiveAudioMetrics): AudioObservations {
  return {
    validAudio: true, validityReason: "", anotherSpeakerDominant: false, backgroundNoiseSevere: false,
    volumeAssessment: objective.volumeAssessment, pitchVariation: objective.pitchVariation, paceAssessment: "good",
    pausingAndEmphasis: "good", audienceEngagement: "good", rushedAtEnd: false,
    unfinishedAtEnd: false, restartCount: 0, articulationIssues: [], articulationConfidence: 0.75, deliveryConfidence: 0.8
  };
}

export async function analyseSpeech(audioBuffer: Buffer, mimeType: string, metadata: AnalyseSpeechMetadata): Promise<AnalyseSpeechResponse> {
  const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "wav";
  const converted = await convertAndMeasureAudio(audioBuffer, extension);
  const objective = converted.metrics;

  if (objective.durationSeconds > 62.5) {
    return { valid: false, invalidReason: "That recording was longer than the one-minute speech window. Please try again." };
  }

  if (objective.voicedSeconds < 5 || objective.speakingDurationSeconds < 5) {
    return { valid: false, invalidReason: "We couldn’t hear enough speech to score that one fairly. Please try again." };
  }

  const transcript = config.mockAi ? "This is a mock transcript used for local development." : await transcribe(converted.wav);
  if (!transcript || wordCount(transcript) < 5) {
    return { valid: false, invalidReason: "We couldn’t understand enough of the recording to score it fairly. Please try again." };
  }

  const audio = config.mockAi ? mockAudio(objective) : await analyseAudio(converted.wav, transcript);
  if (!audio.validAudio || audio.anotherSpeakerDominant || audio.backgroundNoiseSevere) {
    return { valid: false, invalidReason: audio.validityReason || "The recording was too noisy or interrupted to score fairly. Please try again." };
  }

  const metrics = buildMetrics(objective, transcript, audio);
  let raw = config.mockAi ? mockEvaluation(metrics) : await evaluateSpeech(metadata.topic, metadata.level, transcript, metrics, audio, metadata.recentIssueTags);
  raw = enforceDeterministicRules(raw, metrics, audio);
  const scoring = assembleScoringResult({
    rubricVersion: config.RUBRIC_VERSION || RUBRIC_VERSION,
    structure: raw.structure,
    content: raw.content,
    clarity: raw.clarity,
    fluency: raw.fluency,
    delivery: raw.delivery,
    confidence: {
      overall: Math.max(0, Math.min(1, raw.confidence.overall)),
      articulation: Math.max(0, Math.min(1, audio.articulationConfidence || raw.confidence.articulation)),
      delivery: Math.max(0, Math.min(1, audio.deliveryConfidence || raw.confidence.delivery))
    }
  });

  return {
    valid: true,
    metrics,
    scoring,
    strengths: raw.strengths,
    improvements: raw.improvements,
    nextFocus: raw.nextFocus,
    issueTags: raw.issueTags,
    modelConfig: {
      transcriptionModel: config.mockAi ? "mock" : config.TRANSCRIPTION_MODEL,
      audioModel: config.mockAi ? "mock" : config.AUDIO_MODEL,
      scoringModel: config.mockAi ? "mock" : config.SCORING_MODEL
    }
  };
}
