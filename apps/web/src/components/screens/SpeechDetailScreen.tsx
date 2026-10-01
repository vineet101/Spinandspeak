"use client";

import type { SpeechSession } from "@spin-and-speak/domain";
import { ISSUE_LABELS, formatDate } from "@/lib/labels";

const CATEGORIES: Array<[keyof SpeechSession["scores"], string]> = [
  ["structure", "Structure"], ["content", "Content"], ["clarity", "Clarity"], ["fluency", "Fluency"], ["delivery", "Delivery"]
];

export function SpeechDetailScreen({
  session,
  previous,
  speechNumber,
  onBack,
  onHome
}: {
  session: SpeechSession;
  previous?: SpeechSession;
  speechNumber: number;
  onBack: () => void;
  onHome: () => void;
}) {
  const pronunciation = session.metrics.articulationIssues[0];
  const scoreDelta = previous ? session.scores.overall - previous.scores.overall : 0;
  return (
    <main className="screen detail-screen">
      <button className="text-button detail-back" onClick={onBack}>← Back to progress</button>
      <div className="detail-meta">{formatDate(session.createdAt)} · Level {session.level} · Speech #{speechNumber}</div>
      <h1 className="detail-topic">{session.topic}</h1>

      <section className="detail-score-row">
        <div><span>Overall score</span><strong>{session.scores.overall.toFixed(1)}</strong></div>
        <div><span>Speaking time</span><strong>{session.speakingDurationSeconds.toFixed(0)}s</strong></div>
      </section>

      <div className="category-list">
        {CATEGORIES.map(([key, label]) => <div key={key}><span>{label}</span><strong>{session.scores[key].toFixed(1)}</strong></div>)}
      </div>

      <section className="feedback-card good-card"><h2>✓ What went well</h2><p>{session.strengths[0]}</p><p>{session.strengths[1]}</p></section>
      <section className="feedback-card bad-card"><h2>↑ What to improve</h2><p>{session.improvements[0]}</p><p>{session.improvements[1]}</p></section>
      <section className="feedback-card focus-card"><h2>Next-time focus</h2><p>{session.nextFocus}</p></section>

      <section className="metrics-card">
        <h2>Speech details</h2>
        <div className="metric-grid">
          <div><span>Filler words</span><strong>{session.metrics.fillerCount}</strong></div>
          <div><span>Long pauses</span><strong>{session.metrics.longPauseCount}</strong></div>
          <div><span>Speaking time</span><strong>{session.metrics.speakingDurationSeconds.toFixed(0)}s</strong></div>
          <div><span>Voice volume</span><strong>{session.metrics.volumeAssessment === "too_soft" ? "Soft" : session.metrics.volumeAssessment === "too_loud" ? "Too loud" : "Good"}</strong></div>
        </div>
      </section>

      {pronunciation && pronunciation.confidence >= 0.65 && (
        <section className="feedback-card bad-card">
          <h2>Pronunciation example</h2>
          <p>{pronunciation.word ? <><strong>“{pronunciation.word}”</strong>: {pronunciation.issue}</> : pronunciation.issue}</p>
          <p>{pronunciation.coachingTip}</p>
        </section>
      )}

      {previous && (
        <section className="feedback-card good-card">
          <h2>Better than last time</h2>
          <p>{scoreDelta > 0 ? `Overall score improved by ${scoreDelta.toFixed(1)}.` : session.metrics.fillerCount < previous.metrics.fillerCount ? `Filler words dropped from ${previous.metrics.fillerCount} to ${session.metrics.fillerCount}.` : session.improvedIssues[0] ? `You’re improving at ${ISSUE_LABELS[session.improvedIssues[0]]}.` : "Compare the details above to keep spotting small gains."}</p>
        </section>
      )}

      <button className="primary-button wide strong-cta" onClick={onHome}>Back to Home</button>
    </main>
  );
}
