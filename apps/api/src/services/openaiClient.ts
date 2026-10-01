import OpenAI from "openai";
import { config } from "../config.js";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (config.mockAi) {
    throw new Error("OpenAI client requested while MOCK_AI is enabled.");
  }
  if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
  client ??= new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return client;
}
