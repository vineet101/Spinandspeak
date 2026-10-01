import { describe, expect, it } from "vitest";
import type { ChildProfile, SpeechSession } from "@spin-and-speak/domain";
import {
  applyProgression,
  calculateCategoryScores,
  calculateOverallScore,
  deriveIssueHistory,
  fillerComponentScore,
  roundToHalf
} from "../src/index";

const profile: ChildProfile = {
  id: "p1",
  name: "Player",
  currentLevel: 2,
  highestLevelReached: 2,
  levelUpStreak: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z"
};

function session(overall: number, tags: SpeechSession["issueTags"] = []): SpeechSession {
  return {
    id: crypto.randomUUID(), profileId: "p1", createdAt: new Date().toISOString(), topic: "x", level: 2,
    speakingDurationSeconds: 58,
    scores: { overall, structure: overall, content: overall, clarity: overall, fluency: overall, delivery: overall },
    subScores: {
      structure: { opening: overall, logicalFlow: overall, organisation: overall, endingAndTimeManagement: overall },
      content: { relevance: overall, depth: overall, examplesAndDetail: overall, originality: overall },
      clarity: { articulationAndEnunciation: overall, sentenceClarity: overall, intelligibility: overall },
      fluency: { fillerWords: overall, unintendedPauses: overall, restartsAndRepetitions: overall, continuity: overall },
      delivery: { volumeAndProjection: overall, pitchAndTonality: overall, pace: overall, pausingAndEmphasis: overall, audienceEngagement: overall }
    },
    strengths: ["a", "b"], improvements: ["c", "d"], nextFocus: "e",
    metrics: {
      fillerCount: 0, fillerBreakdown: {}, longPauseCount: 0, longPauseDurationSeconds: 0,
      restartCount: 0, wordsPerMinute: 100, speakingDurationSeconds: 58, percentWindowSpoken: 96.7,
      relativeLoudnessDb: -20, volumeAssessment: "good", pitchVariation: "good", pitchRangeSemitones: 8,
      articulationIssues: [], timeManagement: "good"
    },
    issueTags: tags, repeatedIssues: [], persistentIssues: [], improvedIssues: [], resolvedIssues: [],
    rubricVersion: "1.0.0", modelConfig: { transcriptionModel: "x", audioModel: "y", scoringModel: "z" }
  };
}

describe("scoring", () => {
  it("rounds to half points", () => {
    expect(roundToHalf(7.26)).toBe(7.5);
    expect(roundToHalf(7.24)).toBe(7);
  });

  it("calculates weighted category scores and overall", () => {
    const categories = calculateCategoryScores({
      structure: { opening: 8, logicalFlow: 7, organisation: 9, endingAndTimeManagement: 8 },
      content: { relevance: 6, depth: 6, examplesAndDetail: 6, originality: 6 },
      clarity: { articulationAndEnunciation: 10, sentenceClarity: 10, intelligibility: 10 },
      fluency: { fillerWords: 8, unintendedPauses: 8, restartsAndRepetitions: 8, continuity: 8 },
      delivery: { volumeAndProjection: 7, pitchAndTonality: 7, pace: 7, pausingAndEmphasis: 7, audienceEngagement: 7 }
    });
    expect(categories.structure).toBe(8);
    expect(calculateOverallScore(categories)).toBe(8);
  });

  it("uses the agreed filler bands", () => {
    expect(fillerComponentScore(1)).toBe(10);
    expect(fillerComponentScore(3)).toBe(8);
    expect(fillerComponentScore(8)).toBe(4);
    expect(fillerComponentScore(12)).toBe(0);
  });

  it("levels up after the third qualifying speech", () => {
    const current = session(8);
    const result = applyProgression(profile, current, [session(8), session(8.5)]);
    expect(result.levelledUp).toBe(true);
    expect(result.profile.currentLevel).toBe(3);
  });

  it("downgrades only when the last three average is below 4", () => {
    const p = { ...profile, levelUpStreak: 0 };
    const result = applyProgression(p, session(3.5), [session(3.5), session(4)]);
    expect(result.levelledDown).toBe(true);
    expect(result.profile.currentLevel).toBe(1);
    const noDrop = applyProgression(p, session(4), [session(4), session(4)]);
    expect(noDrop.levelledDown).toBe(false);
  });

  it("detects repeated and persistent issues", () => {
    const previous = [
      session(6, ["low_volume"]),
      session(6, ["low_volume"]),
      session(6, []),
      session(6, ["low_volume"])
    ];
    const result = deriveIssueHistory(["low_volume"], previous);
    expect(result.repeated).toContain("low_volume");
    expect(result.persistent).toContain("low_volume");
  });
});

describe("progression safeguards", () => {
  it("does not qualify an 8 overall if a category is below 6.5", () => {
    const current = session(8);
    current.scores.content = 6;
    const result = applyProgression(profile, current, [session(8), session(8.5)]);
    expect(result.levelledUp).toBe(false);
    expect(result.profile.levelUpStreak).toBe(0);
  });

  it("never reduces the highest level reached on downgrade", () => {
    const p = { ...profile, currentLevel: 2 as const, highestLevelReached: 4 as const, levelUpStreak: 0 };
    const result = applyProgression(p, session(3), [session(3.5), session(3.5)]);
    expect(result.levelledDown).toBe(true);
    expect(result.profile.currentLevel).toBe(1);
    expect(result.profile.highestLevelReached).toBe(4);
  });

  it("marks a repeated issue resolved after three consecutive clean speeches", () => {
    const old = session(6, ["low_volume"]);
    old.repeatedIssues = ["low_volume"];
    const result = deriveIssueHistory([], [old, session(7, []), session(7.5, [])]);
    expect(result.resolved).toContain("low_volume");
  });
});
