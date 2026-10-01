import Dexie, { type EntityTable } from "dexie";
import type {
  ChildProfile,
  PendingAttempt,
  SpeechSession,
  TopicHistoryRecord
} from "@spin-and-speak/domain";

export interface AppStateRecord {
  key: string;
  value: unknown;
}

export class SpinSpeakDatabase extends Dexie {
  profiles!: EntityTable<ChildProfile, "id">;
  speechSessions!: EntityTable<SpeechSession, "id">;
  topicHistory!: EntityTable<TopicHistoryRecord, "id">;
  appState!: EntityTable<AppStateRecord, "key">;
  pendingAttempts!: EntityTable<PendingAttempt, "attemptId">;

  constructor() {
    super("SpinAndSpeak");
    this.version(1).stores({
      profiles: "id, name, currentLevel, createdAt, updatedAt",
      speechSessions: "id, profileId, createdAt, level, [profileId+createdAt]",
      topicHistory: "id, level, status, firstShownAt",
      appState: "key",
      pendingAttempts: "attemptId, profileId, createdAt"
    });
  }
}

let singleton: SpinSpeakDatabase | null = null;

export function getDb(): SpinSpeakDatabase {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
  singleton ??= new SpinSpeakDatabase();
  return singleton;
}

export async function getAppState<T>(key: string): Promise<T | undefined> {
  const record = await getDb().appState.get(key);
  return record?.value as T | undefined;
}

export async function setAppState<T>(key: string, value: T): Promise<void> {
  await getDb().appState.put({ key, value });
}
