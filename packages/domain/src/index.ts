export type Level = 1 | 2 | 3 | 4 | 5;
export type Score = number;

export const RUBRIC_VERSION = "1.0.0" as const;

export type IssueTag =
  | "too_many_fillers"
  | "long_pauses"
  | "too_many_restarts"
  | "low_continuity"
  | "low_volume"
  | "monotone_delivery"
  | "rushed_delivery"
  | "weak_opening"
  | "weak_ending"
  | "poor_time_management"
  | "ideas_not_developed"
  | "dropped_word_endings";

export interface ChildProfile {
  id: string;
  name: string;
  currentLevel: Level;
  highestLevelReached: Level;
  levelUpStreak: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticulationIssue {
  word?: string;
  issue: string;
  coachingTip: string;
  confidence: number;
}

export type VolumeAssessment = "too_soft" | "good" | "too_loud";
export type PitchVariation = "low" | "good" | "high";
export type TimeManagement = "finished_too_early" | "good" | "unfinished_at_60";

export interface SpeechMetrics {
  fillerCount: number;
  fillerBreakdown: Record<string, number>;
  longPauseCount: number;
  longPauseDurationSeconds: number;
  restartCount: number;
  wordsPerMinute: number;
  speakingDurationSeconds: number;
  percentWindowSpoken: number;
  relativeLoudnessDb: number;
  volumeAssessment: VolumeAssessment;
  pitchVariation: PitchVariation;
  pitchRangeSemitones: number;
  articulationIssues: ArticulationIssue[];
  timeManagement: TimeManagement;
}

export interface StructureScores {
  opening: Score;
  logicalFlow: Score;
  organisation: Score;
  endingAndTimeManagement: Score;
}

export interface ContentScores {
  relevance: Score;
  depth: Score;
  examplesAndDetail: Score;
  originality: Score;
}

export interface ClarityScores {
  articulationAndEnunciation: Score;
  sentenceClarity: Score;
  intelligibility: Score;
}

export interface FluencyScores {
  fillerWords: Score;
  unintendedPauses: Score;
  restartsAndRepetitions: Score;
  continuity: Score;
}

export interface DeliveryScores {
  volumeAndProjection: Score;
  pitchAndTonality: Score;
  pace: Score;
  pausingAndEmphasis: Score;
  audienceEngagement: Score;
}

export interface CategoryScores {
  structure: Score;
  content: Score;
  clarity: Score;
  fluency: Score;
  delivery: Score;
}

export interface ScoringResult {
  rubricVersion: string;
  structure: StructureScores;
  content: ContentScores;
  clarity: ClarityScores;
  fluency: FluencyScores;
  delivery: DeliveryScores;
  categoryScores: CategoryScores;
  overallScore: Score;
  confidence: {
    overall: number;
    articulation: number;
    delivery: number;
  };
}

export interface SpeechSession {
  id: string;
  profileId: string;
  createdAt: string;
  topic: string;
  level: Level;
  speakingDurationSeconds: number;
  scores: CategoryScores & { overall: Score };
  subScores: Omit<ScoringResult, "categoryScores" | "overallScore" | "confidence" | "rubricVersion">;
  strengths: [string, string];
  improvements: [string, string];
  nextFocus: string;
  metrics: SpeechMetrics;
  issueTags: IssueTag[];
  repeatedIssues: IssueTag[];
  persistentIssues: IssueTag[];
  improvedIssues: IssueTag[];
  resolvedIssues: IssueTag[];
  rubricVersion: string;
  modelConfig: {
    transcriptionModel: string;
    audioModel: string;
    scoringModel: string;
  };
}

export interface TopicHistoryRecord {
  id: string;
  topic: string;
  level: Level;
  status: "accepted" | "skipped";
  semanticFingerprint: string;
  firstShownAt: string;
}

export interface PendingAttempt {
  attemptId: string;
  profileId: string;
  topic: string;
  level: Level;
  audioBlob: Blob;
  audioMimeType: string;
  recentIssueTags: IssueTag[];
  createdAt: string;
}

export const LEVEL_LABELS: Record<Level, string> = {
  1: "Familiar",
  2: "Opinion",
  3: "Reasoning",
  4: "Abstract",
  5: "Advanced"
};
