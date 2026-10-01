import crypto from "node:crypto";
import type { GenerateTopicRequest, GenerateTopicResponse } from "@spin-and-speak/api-types";
import type { Level } from "@spin-and-speak/domain";
import { config } from "../config.js";
import { getOpenAI } from "./openaiClient.js";

const MOCK_TOPICS: Record<Level, string[]> = {
  1: ["My favourite place", "The best day of the week", "A food I could eat every day", "A hobby I would teach someone", "The perfect weekend"],
  2: ["Should children have homework?", "Should school start later?", "Is it better to read a book or watch a film?", "Should every child learn to cook?", "Should pets be allowed in classrooms?"],
  3: ["Which matters more, talent or hard work?", "Is it better to plan carefully or be spontaneous?", "What makes a good teammate?", "Is winning more important than improving?", "Should people spend more time outdoors?"],
  4: ["Can failure be a good thing?", "What makes something fair?", "Is being brave the same as not being afraid?", "Can a small decision change a life?", "What makes someone a leader?"],
  5: ["Should AI make important decisions for people?", "Is convenience always a good thing?", "Should technology have limits?", "Can competition make society better?", "What responsibilities come with freedom?"]
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(text: string): Set<string> {
  const stop = new Set(["a", "an", "the", "is", "are", "be", "to", "of", "for", "and", "or", "should", "can", "what", "which", "it"]);
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2 && !stop.has(w)));
}

function jaccard(a: string, b: string): number {
  const aa = tokenSet(a); const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  const union = new Set([...aa, ...bb]).size;
  return intersection / union;
}

function encodeEmbedding(values: number[]): string {
  const buffer = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return `emb:${buffer.toString("base64")}`;
}

function decodeEmbedding(value: string): number[] | null {
  try {
    if (!value.startsWith("emb:")) return null;
    const buffer = Buffer.from(value.slice(4), "base64");
    if (buffer.length < 4 || buffer.length % 4 !== 0) return null;
    const output: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) output.push(buffer.readFloatLE(i));
    return output;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0; const bv = b[i] ?? 0;
    dot += av * bv; aa += av * av; bb += bv * bv;
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

async function embed(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
    dimensions: 256
  });
  return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

async function generateCandidates(level: Level, usedTopics: string[]): Promise<string[]> {
  const openai = getOpenAI();
  const response = await openai.responses.create({
    model: config.TOPIC_MODEL,
    reasoning: { effort: "none" },
    input: [
      {
        role: "developer",
        content: `Generate impromptu speaking topics for children aged 9-11.\n\nDifficulty levels:\n1 Familiar: everyday and personal.\n2 Opinion: take a view and explain.\n3 Reasoning: compare, justify, or argue.\n4 Abstract: deeper but child-accessible ideas.\n5 Advanced: complex or unfamiliar ideas without requiring specialist knowledge.\n\nRules: age-appropriate, no research required, understandable immediately, broad enough for a 60-second speech, no adult, medical, political, sexual, violent, or distressing themes. Vary formats across single themes, opinions, comparisons, imaginative prompts, reasoning, and abstract questions. Do not repeat or closely paraphrase any used topic.`
      },
      {
        role: "user",
        content: `Level: ${level}\nPreviously used topics (avoid meaning-level duplicates):\n${usedTopics.slice(-150).map((t) => `- ${t}`).join("\n") || "None"}\n\nReturn 8 distinct candidates.`
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "topic_candidates",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            candidates: {
              type: "array",
              minItems: 8,
              maxItems: 8,
              items: { type: "string", minLength: 3, maxLength: 140 }
            }
          },
          required: ["candidates"]
        }
      }
    }
  });
  const parsed = JSON.parse(response.output_text) as { candidates: string[] };
  return parsed.candidates;
}

export async function createTopic(request: GenerateTopicRequest): Promise<GenerateTopicResponse> {
  if (config.mockAi) {
    const used = new Set(request.usedTopics.map((t) => normalize(t.topic)));
    const candidate = MOCK_TOPICS[request.level].find((t) => !used.has(normalize(t)))
      ?? `${MOCK_TOPICS[request.level][0]} - another angle ${request.usedTopics.length + 1}`;
    return {
      topicId: crypto.randomUUID(),
      topic: candidate,
      level: request.level,
      semanticFingerprint: `text:${Buffer.from(normalize(candidate)).toString("base64")}`
    };
  }

  const usedVectors = request.usedTopics.map((item) => decodeEmbedding(item.semanticFingerprint));
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = await generateCandidates(request.level, request.usedTopics.map((t) => t.topic));
    const vectors = await embed(candidates);
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const vector = vectors[i];
      if (!candidate || !vector) continue;
      const exactOrLexical = request.usedTopics.some((used) =>
        normalize(used.topic) === normalize(candidate) || jaccard(used.topic, candidate) >= 0.70
      );
      if (exactOrLexical) continue;
      const tooSimilar = usedVectors.some((used) => used && cosine(used, vector) >= config.TOPIC_SIMILARITY_THRESHOLD);
      if (tooSimilar) continue;
      return {
        topicId: crypto.randomUUID(),
        topic: candidate,
        level: request.level,
        semanticFingerprint: encodeEmbedding(vector)
      };
    }
  }
  throw new Error("Unable to generate a sufficiently unique topic. Please try again.");
}
