import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
  INSTALL_TOKEN_SECRET: z.string().optional(),
  RUBRIC_VERSION: z.string().default("1.0.0"),
  TRANSCRIPTION_MODEL: z.string().default("gpt-transcribe"),
  AUDIO_MODEL: z.string().default("gpt-audio-1.5"),
  SCORING_MODEL: z.string().default("gpt-6-luna"),
  TOPIC_MODEL: z.string().default("gpt-6-luna"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  TOPIC_SIMILARITY_THRESHOLD: z.coerce.number().min(0.5).max(0.99).default(0.82),
  MAX_AUDIO_MB: z.coerce.number().min(1).max(100).default(20),
  MAX_SPEECHES_PER_DAY: z.coerce.number().int().min(1).default(20),
  MAX_GLOBAL_SPEECHES_PER_DAY: z.coerce.number().int().min(1).default(200),
  MAX_INSTALLS_PER_HOUR: z.coerce.number().int().min(1).default(30),
  MAX_TOPICS_PER_HOUR: z.coerce.number().int().min(1).default(60),
  MOCK_AI: z.string().optional()
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === "production" && !parsed.INSTALL_TOKEN_SECRET) {
  throw new Error("INSTALL_TOKEN_SECRET is required in production.");
}

if (parsed.NODE_ENV === "production" && parsed.MOCK_AI !== "true" && !parsed.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required in production unless MOCK_AI=true.");
}

export const config = {
  ...parsed,
  installTokenSecret: parsed.INSTALL_TOKEN_SECRET ?? "dev-only-spin-speak-secret-change-me",
  mockAi: parsed.MOCK_AI === "true" || !parsed.OPENAI_API_KEY,
  allowedOrigins: parsed.ALLOWED_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean),
  maxAudioBytes: parsed.MAX_AUDIO_MB * 1024 * 1024
};
