"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GenerateTopicResponse } from "@spin-and-speak/api-types";
import type { ChildProfile, IssueTag, Level, PendingAttempt, SpeechSession, TopicHistoryRecord } from "@spin-and-speak/domain";
import { RUBRIC_VERSION } from "@spin-and-speak/domain";
import { applyProgression, deriveIssueHistory } from "@spin-and-speak/scoring";
import { getAppState, getDb, setAppState } from "@spin-and-speak/storage";
import { analyseSpeech, generateTopic } from "@/lib/api";
import { primeAudio } from "@/lib/audioCues";
import { useRecorder } from "@/hooks/useRecorder";
import { ProfileSelectScreen } from "./screens/ProfileSelectScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { TopicScreen } from "./screens/TopicScreen";
import { ThinkScreen } from "./screens/ThinkScreen";
import { CountdownScreen } from "./screens/CountdownScreen";
import { SpeakScreen } from "./screens/SpeakScreen";
import { ScoringScreen } from "./screens/ScoringScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SpeechDetailScreen } from "./screens/SpeechDetailScreen";

type View = "profiles" | "home" | "topic" | "think" | "countdown" | "speak" | "scoring" | "results" | "progress" | "detail";

interface ActiveContext {
  topic: string;
  level: Level;
}

export function SpinSpeakApp() {
  const { prepare: prepareRecorder, start: startRecorder, stop: stopRecorder, release: releaseRecorder, level: micLevel } = useRecorder();
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [sessions, setSessions] = useState<SpeechSession[]>([]);
  const [view, setView] = useState<View>("profiles");
  const [topicOffer, setTopicOffer] = useState<GenerateTopicResponse | null>(null);
  const [topicHistoryId, setTopicHistoryId] = useState<string | null>(null);
  const [skipUsed, setSkipUsed] = useState(false);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicError, setTopicError] = useState<string>();
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [pending, setPending] = useState<PendingAttempt | null>(null);
  const [recoveryPending, setRecoveryPending] = useState<PendingAttempt | null>(null);
  const [scoringError, setScoringError] = useState<string>();
  const [invalidReason, setInvalidReason] = useState<string>();
  const [result, setResult] = useState<SpeechSession | null>(null);
  const [detail, setDetail] = useState<SpeechSession | null>(null);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [levelUpTo, setLevelUpTo] = useState<Level | null>(null);

  const loadSessions = useCallback(async (profileId: string) => {
    const all = await getDb().speechSessions.where("profileId").equals(profileId).sortBy("createdAt");
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setSessions(all);
    return all;
  }, []);

  useEffect(() => {
    void (async () => {
      const db = getDb();
      const allProfiles = await db.profiles.orderBy("createdAt").toArray();
      setProfiles(allProfiles);
      const pendingAttempts = await db.pendingAttempts.orderBy("createdAt").toArray();
      if (pendingAttempts.length) setRecoveryPending(pendingAttempts[pendingAttempts.length - 1] ?? null);
      const lastId = await getAppState<string>("lastSelectedProfileId");
      if (lastId) {
        const last = allProfiles.find((p) => p.id === lastId);
        if (last) {
          setProfile(last);
          await loadSessions(last.id);
          setView("home");
        }
      }
      setReady(true);
    })().catch((error) => {
      setNotice(error instanceof Error ? error.message : "Could not open local storage.");
      setReady(true);
    });
  }, [loadSessions]);

  const selectProfile = useCallback(async (selected: ChildProfile) => {
    setProfile(selected);
    await setAppState("lastSelectedProfileId", selected.id);
    await loadSessions(selected.id);
    setView("home");
  }, [loadSessions]);

  const createProfile = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const newProfile: ChildProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      currentLevel: 1,
      highestLevelReached: 1,
      levelUpStreak: 0,
      createdAt: now,
      updatedAt: now
    };
    await getDb().profiles.add(newProfile);
    setProfiles((current) => [...current, newProfile]);
    setShowAddProfile(false);
    await selectProfile(newProfile);
  }, [selectProfile]);

  const resetToHome = useCallback(() => {
    releaseRecorder();
    setTopicOffer(null);
    setTopicHistoryId(null);
    setSkipUsed(false);
    setTopicError(undefined);
    setActiveContext(null);
    setPending(null);
    setScoringError(undefined);
    setInvalidReason(undefined);
    setResult(null);
    setDetail(null);
    setLevelUpTo(null);
    setView(profile ? "home" : "profiles");
  }, [profile, releaseRecorder]);

  const fetchTopic = useCallback(async (level: Level, secondTopic = false) => {
    setTopicBusy(true);
    setTopicError(undefined);
    try {
      const history = await getDb().topicHistory.orderBy("firstShownAt").toArray();
      const generated = await generateTopic({
        level,
        usedTopics: history.map((item) => ({ topic: item.topic, semanticFingerprint: item.semanticFingerprint }))
      });
      const historyRecord: TopicHistoryRecord = {
        id: generated.topicId,
        topic: generated.topic,
        level: generated.level,
        status: "accepted",
        semanticFingerprint: generated.semanticFingerprint,
        firstShownAt: new Date().toISOString()
      };
      await getDb().topicHistory.put(historyRecord);
      setTopicHistoryId(historyRecord.id);
      setTopicOffer(generated);
      setSkipUsed(secondTopic);
      setView("topic");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn’t generate a topic.";
      setTopicError(message);
      setNotice(message);
    } finally {
      setTopicBusy(false);
    }
  }, []);

  const startTopic = useCallback(async () => {
    if (!profile) return;
    await fetchTopic(profile.currentLevel, false);
  }, [fetchTopic, profile]);

  const skipTopic = useCallback(async () => {
    if (!profile || !topicHistoryId || skipUsed) return;
    setTopicBusy(true);
    try {
      await getDb().topicHistory.update(topicHistoryId, { status: "skipped" });
      await fetchTopic(profile.currentLevel, true);
    } finally {
      setTopicBusy(false);
    }
  }, [fetchTopic, profile, skipUsed, topicHistoryId]);

  const acceptTopic = useCallback(async () => {
    if (!topicOffer) return;
    setTopicBusy(true);
    setTopicError(undefined);
    try {
      primeAudio();
      await prepareRecorder();
      setActiveContext({ topic: topicOffer.topic, level: topicOffer.level });
      setView("think");
    } catch (error) {
      setTopicError(error instanceof Error ? error.message : "Microphone access is needed to record your speech.");
    } finally {
      setTopicBusy(false);
    }
  }, [prepareRecorder, topicOffer]);

  const beginCountdown = useCallback(() => setView("countdown"), []);
  const beginSpeaking = useCallback(() => {
    try {
      startRecorder();
      setView("speak");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start recording.");
      setView("topic");
    }
  }, [startRecorder]);

  const scorePending = useCallback(async (attempt: PendingAttempt) => {
    setPending(attempt);
    setActiveContext({ topic: attempt.topic, level: attempt.level });
    setScoringError(undefined);
    setInvalidReason(undefined);
    setView("scoring");
    try {
      const response = await analyseSpeech(attempt.audioBlob, {
        sessionAttemptId: attempt.attemptId,
        topic: attempt.topic,
        level: attempt.level,
        recentIssueTags: attempt.recentIssueTags,
        rubricVersion: RUBRIC_VERSION
      });
      if (!response.valid) {
        await getDb().pendingAttempts.delete(attempt.attemptId);
        setPending(null);
        setRecoveryPending(null);
        setInvalidReason(response.invalidReason || "We couldn’t score that recording fairly.");
        return;
      }
      if (!response.metrics || !response.scoring || !response.strengths || !response.improvements || !response.nextFocus || !response.issueTags || !response.modelConfig) {
        throw new Error("The scoring response was incomplete. Your recording is safe, so you can retry.");
      }
      const currentProfile = await getDb().profiles.get(attempt.profileId);
      if (!currentProfile) throw new Error("The player profile for this speech could not be found.");
      const previous = await getDb().speechSessions.where("profileId").equals(attempt.profileId).sortBy("createdAt");
      const issueHistory = deriveIssueHistory(response.issueTags, previous);
      const scoreRecord = {
        overall: response.scoring.overallScore,
        ...response.scoring.categoryScores
      };
      const progression = applyProgression(
        currentProfile,
        { level: attempt.level, scores: scoreRecord },
        previous.filter((item) => item.level === attempt.level)
      );
      const session: SpeechSession = {
        id: crypto.randomUUID(),
        profileId: attempt.profileId,
        createdAt: new Date().toISOString(),
        topic: attempt.topic,
        level: attempt.level,
        speakingDurationSeconds: response.metrics.speakingDurationSeconds,
        scores: scoreRecord,
        subScores: {
          structure: response.scoring.structure,
          content: response.scoring.content,
          clarity: response.scoring.clarity,
          fluency: response.scoring.fluency,
          delivery: response.scoring.delivery
        },
        strengths: response.strengths,
        improvements: response.improvements,
        nextFocus: response.nextFocus,
        metrics: response.metrics,
        issueTags: response.issueTags,
        repeatedIssues: issueHistory.repeated,
        persistentIssues: issueHistory.persistent,
        improvedIssues: issueHistory.improved,
        resolvedIssues: issueHistory.resolved,
        rubricVersion: response.scoring.rubricVersion,
        modelConfig: response.modelConfig
      };
      const db = getDb();
      await db.transaction("rw", db.speechSessions, db.profiles, db.pendingAttempts, async () => {
        await db.speechSessions.add(session);
        await db.profiles.put(progression.profile);
        await db.pendingAttempts.delete(attempt.attemptId);
      });
      setProfile(progression.profile);
      setProfiles((list) => list.map((p) => p.id === progression.profile.id ? progression.profile : p));
      if (progression.levelledUp) setLevelUpTo(progression.profile.currentLevel);
      setResult(session);
      setPending(null);
      setRecoveryPending(null);
      await loadSessions(attempt.profileId);
      setView("results");
    } catch (error) {
      setScoringError(error instanceof Error ? error.message : "Scoring failed. Please try again.");
    }
  }, [loadSessions]);

  const finishSpeaking = useCallback(async () => {
    if (!profile || !activeContext) return;
    try {
      const blob = await stopRecorder();
      releaseRecorder();
      const recent = sessions.slice(0, 3).flatMap((item) => item.issueTags);
      const recentIssueTags = [...new Set(recent)] as IssueTag[];
      const attempt: PendingAttempt = {
        attemptId: crypto.randomUUID(),
        profileId: profile.id,
        topic: activeContext.topic,
        level: activeContext.level,
        audioBlob: blob,
        audioMimeType: blob.type,
        recentIssueTags,
        createdAt: new Date().toISOString()
      };
      await getDb().pendingAttempts.put(attempt);
      await scorePending(attempt);
    } catch (error) {
      releaseRecorder();
      setNotice(error instanceof Error ? error.message : "The recording could not be saved.");
      setView("home");
    }
  }, [activeContext, profile, releaseRecorder, scorePending, sessions, stopRecorder]);

  const handleFinishSpeaking = useCallback(() => { void finishSpeaking(); }, [finishSpeaking]);

  const retrySpeech = useCallback(async () => {
    if (!activeContext) return;
    setInvalidReason(undefined);
    setScoringError(undefined);
    try {
      primeAudio();
      await prepareRecorder();
      setView("think");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Microphone access is needed.");
      setView("home");
    }
  }, [activeContext, prepareRecorder]);

  const discardPending = useCallback(async () => {
    if (pending) await getDb().pendingAttempts.delete(pending.attemptId);
    if (recoveryPending) await getDb().pendingAttempts.delete(recoveryPending.attemptId);
    setPending(null);
    setRecoveryPending(null);
    resetToHome();
  }, [pending, recoveryPending, resetToHome]);

  const resumePending = useCallback(async () => {
    if (!recoveryPending) return;
    const targetProfile = await getDb().profiles.get(recoveryPending.profileId);
    if (!targetProfile) {
      await getDb().pendingAttempts.delete(recoveryPending.attemptId);
      setRecoveryPending(null);
      return;
    }
    setProfile(targetProfile);
    await setAppState("lastSelectedProfileId", targetProfile.id);
    await loadSessions(targetProfile.id);
    await scorePending(recoveryPending);
  }, [loadSessions, recoveryPending, scorePending]);

  const openProgress = useCallback(async () => {
    if (profile) await loadSessions(profile.id);
    setView("progress");
  }, [loadSessions, profile]);

  const openDetail = useCallback((session: SpeechSession) => {
    setDetail(session); setView("detail");
  }, []);

  const previousForDetail = useMemo(() => {
    if (!detail) return undefined;
    const index = sessions.findIndex((item) => item.id === detail.id);
    return index >= 0 ? sessions[index + 1] : undefined;
  }, [detail, sessions]);

  if (!ready) {
    return <main className="screen centered-screen"><div className="brand-mark loading-mark">S</div><p>Loading Spin &amp; Speak…</p></main>;
  }

  let content: React.ReactNode;
  if (view === "profiles" || !profile) {
    content = <ProfileSelectScreen profiles={profiles} onSelect={(p) => void selectProfile(p)} onAdd={() => setShowAddProfile(true)} />;
  } else if (view === "home") {
    content = <HomeScreen profile={profile} onTopic={() => void startTopic()} onProgress={() => void openProgress()} onSwitchProfile={() => setView("profiles")} loadingTopic={topicBusy} />;
  } else if (view === "topic" && topicOffer) {
    content = <TopicScreen topic={topicOffer} skipUsed={skipUsed} onSkip={() => void skipTopic()} onAccept={() => void acceptTopic()} onBack={resetToHome} busy={topicBusy} error={topicError} />;
  } else if (view === "think" && activeContext) {
    content = <ThinkScreen topic={activeContext.topic} onComplete={beginCountdown} />;
  } else if (view === "countdown" && activeContext) {
    content = <CountdownScreen topic={activeContext.topic} onComplete={beginSpeaking} />;
  } else if (view === "speak" && activeContext) {
    content = <SpeakScreen topic={activeContext.topic} micLevel={micLevel} onComplete={handleFinishSpeaking} />;
  } else if (view === "scoring") {
    content = <ScoringScreen error={scoringError} invalidReason={invalidReason} onRetryScore={() => pending && void scorePending(pending)} onRetrySpeech={() => void retrySpeech()} onDiscard={() => void discardPending()} />;
  } else if (view === "results" && result) {
    content = <ResultsScreen session={result} onProgress={() => void openProgress()} />;
  } else if (view === "progress") {
    content = <ProgressScreen profile={profile} sessions={sessions} onSpeech={openDetail} onHome={resetToHome} />;
  } else if (view === "detail" && detail) {
    content = <SpeechDetailScreen session={detail} previous={previousForDetail} speechNumber={Math.max(1, sessions.length - sessions.findIndex((item) => item.id === detail.id))} onBack={() => setView("progress")} onHome={resetToHome} />;
  } else {
    content = <HomeScreen profile={profile} onTopic={() => void startTopic()} onProgress={() => void openProgress()} onSwitchProfile={() => setView("profiles")} loadingTopic={topicBusy} />;
  }

  return (
    <div className="app-shell">
      {content}
      {showAddProfile && <AddProfileModal onCancel={() => setShowAddProfile(false)} onCreate={(name) => void createProfile(name)} />}
      {recoveryPending && view !== "scoring" && (
        <div className="modal-backdrop">
          <div className="modal-card recovery-card" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <div className="status-icon warning">↻</div>
            <h2 id="recovery-title">You have a speech waiting to be scored.</h2>
            <p>Your recording stayed on this device because scoring did not finish.</p>
            <button className="primary-button wide" onClick={() => void resumePending()}>Score my speech</button>
            <button className="text-button" onClick={() => void discardPending()}>Discard</button>
          </div>
        </div>
      )}
      {levelUpTo && view === "results" && (
        <div className="level-up-toast" onClick={() => setLevelUpTo(null)} role="status">
          <span>★</span><strong>Level {levelUpTo} unlocked!</strong><small>Tap to close</small>
        </div>
      )}
      {notice && <button className="toast" onClick={() => setNotice(undefined)}>{notice}<span>×</span></button>}
    </div>
  );
}

function AddProfileModal({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim()); }}>
        <p className="eyebrow">New player</p>
        <h2>Add a player</h2>
        <label className="field-label" htmlFor="player-name">Name</label>
        <input id="player-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={30} placeholder="e.g. Maya" />
        <p className="quiet-note">New players start at Level 1.</p>
        <button className="primary-button wide" type="submit" disabled={!name.trim()}>Create Profile</button>
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  );
}
