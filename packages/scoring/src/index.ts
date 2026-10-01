import type {
  CategoryScores,
  ChildProfile,
  ContentScores,
  DeliveryScores,
  FluencyScores,
  IssueTag,
  Level,
  ScoringResult,
  SpeechSession,
  StructureScores,
  ClarityScores
} from "@spin-and-speak/domain";

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function weightedScore(values: Array<[number, number]>): number {
  return roundToHalf(values.reduce((sum, [score, weight]) => sum + score * weight, 0));
}

export function calculateCategoryScores(input: {
  structure: StructureScores;
  content: ContentScores;
  clarity: ClarityScores;
  fluency: FluencyScores;
  delivery: DeliveryScores;
}): CategoryScores {
  return {
    structure: weightedScore([
      [input.structure.opening, 0.20],
      [input.structure.logicalFlow, 0.40],
      [input.structure.organisation, 0.25],
      [input.structure.endingAndTimeManagement, 0.15]
    ]),
    content: weightedScore([
      [input.content.relevance, 0.25],
      [input.content.depth, 0.30],
      [input.content.examplesAndDetail, 0.25],
      [input.content.originality, 0.20]
    ]),
    clarity: weightedScore([
      [input.clarity.articulationAndEnunciation, 0.50],
      [input.clarity.sentenceClarity, 0.25],
      [input.clarity.intelligibility, 0.25]
    ]),
    fluency: weightedScore([
      [input.fluency.fillerWords, 0.25],
      [input.fluency.unintendedPauses, 0.25],
      [input.fluency.restartsAndRepetitions, 0.20],
      [input.fluency.continuity, 0.30]
    ]),
    delivery: weightedScore([
      [input.delivery.volumeAndProjection, 0.30],
      [input.delivery.pitchAndTonality, 0.25],
      [input.delivery.pace, 0.20],
      [input.delivery.pausingAndEmphasis, 0.15],
      [input.delivery.audienceEngagement, 0.10]
    ])
  };
}

export function calculateOverallScore(scores: CategoryScores): number {
  return roundToHalf(
    (scores.structure + scores.content + scores.clarity + scores.fluency + scores.delivery) / 5
  );
}

export function assembleScoringResult(
  raw: Omit<ScoringResult, "categoryScores" | "overallScore">,
): ScoringResult {
  const categoryScores = calculateCategoryScores(raw);
  return {
    ...raw,
    categoryScores,
    overallScore: calculateOverallScore(categoryScores)
  };
}

export function fillerComponentScore(count: number): number {
  if (count <= 1) return 10;
  if (count <= 3) return 8;
  if (count <= 5) return 6;
  if (count <= 8) return 4;
  if (count <= 11) return 2;
  return 0;
}

export function qualifiesForLevelUp(scores: CategoryScores, overall: number): boolean {
  return overall >= 8 && Math.min(
    scores.structure,
    scores.content,
    scores.clarity,
    scores.fluency,
    scores.delivery
  ) >= 6.5;
}

export interface ProgressionOutcome {
  profile: ChildProfile;
  levelledUp: boolean;
  levelledDown: boolean;
}

export function applyProgression(
  profile: ChildProfile,
  currentSpeech: Pick<SpeechSession, "level" | "scores">,
  previousSessionsAtLevel: Pick<SpeechSession, "level" | "scores">[]
): ProgressionOutcome {
  const next = { ...profile, updatedAt: new Date().toISOString() };
  let levelledUp = false;
  let levelledDown = false;

  const qualified = currentSpeech.level === profile.currentLevel &&
    qualifiesForLevelUp(currentSpeech.scores, currentSpeech.scores.overall);

  if (qualified) {
    next.levelUpStreak += 1;
    if (next.levelUpStreak >= 3 && next.currentLevel < 5) {
      next.currentLevel = (next.currentLevel + 1) as Level;
      next.highestLevelReached = Math.max(next.highestLevelReached, next.currentLevel) as Level;
      next.levelUpStreak = 0;
      levelledUp = true;
    }
  } else if (currentSpeech.level === profile.currentLevel) {
    next.levelUpStreak = 0;
  }

  if (!levelledUp && profile.currentLevel > 1 && currentSpeech.level === profile.currentLevel) {
    const lastTwo = previousSessionsAtLevel
      .filter((s) => s.level === profile.currentLevel)
      .slice(-2);
    const lastThree = [...lastTwo, currentSpeech];
    if (lastThree.length === 3) {
      const avg = lastThree.reduce((sum, s) => sum + s.scores.overall, 0) / 3;
      if (avg < 4) {
        next.currentLevel = (profile.currentLevel - 1) as Level;
        next.levelUpStreak = 0;
        levelledDown = true;
      }
    }
  }

  return { profile: next, levelledUp, levelledDown };
}

function occurrences(tag: IssueTag, sessions: Pick<SpeechSession, "issueTags">[]): number {
  return sessions.filter((session) => session.issueTags.includes(tag)).length;
}

export interface IssueHistory {
  repeated: IssueTag[];
  persistent: IssueTag[];
  improved: IssueTag[];
  resolved: IssueTag[];
}

export function deriveIssueHistory(
  currentTags: IssueTag[],
  previousSessions: Pick<SpeechSession, "issueTags" | "repeatedIssues" | "persistentIssues">[]
): IssueHistory {
  const recentIncludingCurrent = [
    ...previousSessions.slice(-4).map((s) => ({ issueTags: s.issueTags })),
    { issueTags: currentTags }
  ];
  const allTags = new Set<IssueTag>([
    ...currentTags,
    ...previousSessions.flatMap((s) => s.issueTags),
    ...previousSessions.flatMap((s) => s.repeatedIssues),
    ...previousSessions.flatMap((s) => s.persistentIssues)
  ]);

  const last3 = recentIncludingCurrent.slice(-3);
  const last5 = recentIncludingCurrent.slice(-5);
  const repeated = [...allTags].filter((tag) => occurrences(tag, last3) >= 2);
  const persistent = [...allTags].filter((tag) => last5.length >= 5 && occurrences(tag, last5) >= 4);

  const previousRepeated = new Set<IssueTag>(
    previousSessions.flatMap((s) => [...s.repeatedIssues, ...s.persistentIssues])
  );

  const last2 = recentIncludingCurrent.slice(-2);
  const last3Only = recentIncludingCurrent.slice(-3);
  const improved = [...previousRepeated].filter(
    (tag) => last2.length === 2 && occurrences(tag, last2) === 0
  );
  const resolved = [...previousRepeated].filter(
    (tag) => last3Only.length === 3 && occurrences(tag, last3Only) === 0
  );

  return { repeated, persistent, improved, resolved };
}
