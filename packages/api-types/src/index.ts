import { z } from "zod";
import type {
  IssueTag,
  Level,
  ScoringResult,
  SpeechMetrics
} from "@spin-and-speak/domain";

export const levelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)
]);

export const issueTagSchema = z.enum([
  "too_many_fillers",
  "long_pauses",
  "too_many_restarts",
  "low_continuity",
  "low_volume",
  "monotone_delivery",
  "rushed_delivery",
  "weak_opening",
  "weak_ending",
  "poor_time_management",
  "ideas_not_developed",
  "dropped_word_endings"
]);

export const topicHistoryInputSchema = z.object({
  topic: z.string().min(1).max(180),
  semanticFingerprint: z.string().max(5000)
});

export const generateTopicRequestSchema = z.object({
  level: levelSchema,
  usedTopics: z.array(topicHistoryInputSchema).max(1000)
});

export interface GenerateTopicRequest {
  level: Level;
  usedTopics: { topic: string; semanticFingerprint: string }[];
}

export interface GenerateTopicResponse {
  topicId: string;
  topic: string;
  level: Level;
  semanticFingerprint: string;
}

export const analyseSpeechMetadataSchema = z.object({
  sessionAttemptId: z.string().uuid(),
  topic: z.string().min(1).max(180),
  level: levelSchema,
  recentIssueTags: z.array(issueTagSchema).max(15),
  rubricVersion: z.string().min(1).max(30)
});

export interface AnalyseSpeechMetadata {
  sessionAttemptId: string;
  topic: string;
  level: Level;
  recentIssueTags: IssueTag[];
  rubricVersion: string;
}

export interface RegisterInstallResponse {
  installToken: string;
}

export interface AnalyseSpeechResponse {
  valid: boolean;
  invalidReason?: string;
  metrics?: SpeechMetrics;
  scoring?: ScoringResult;
  strengths?: [string, string];
  improvements?: [string, string];
  nextFocus?: string;
  issueTags?: IssueTag[];
  modelConfig?: {
    transcriptionModel: string;
    audioModel: string;
    scoringModel: string;
  };
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}
