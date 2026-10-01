import type {
  AnalyseSpeechMetadata,
  AnalyseSpeechResponse,
  GenerateTopicRequest,
  GenerateTopicResponse,
  RegisterInstallResponse
} from "@spin-and-speak/api-types";
import { getAppState, setAppState } from "@spin-and-speak/storage";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const INSTALL_TOKEN_KEY = "installToken";

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const token = await ensureInstallToken();
    headers.set("Authorization", `Bearer ${token}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureInstallToken(): Promise<string> {
  const existing = await getAppState<string>(INSTALL_TOKEN_KEY);
  if (existing) return existing;
  const result = await request<RegisterInstallResponse>("/v1/install/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  }, false);
  await setAppState(INSTALL_TOKEN_KEY, result.installToken);
  return result.installToken;
}

export function generateTopic(input: GenerateTopicRequest): Promise<GenerateTopicResponse> {
  return request<GenerateTopicResponse>("/v1/topics/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function analyseSpeech(audio: Blob, metadata: AnalyseSpeechMetadata): Promise<AnalyseSpeechResponse> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
  form.append("audio", audio, `speech.${ext}`);
  form.append("metadata", JSON.stringify(metadata));
  return request<AnalyseSpeechResponse>("/v1/speech/analyse", { method: "POST", body: form });
}
