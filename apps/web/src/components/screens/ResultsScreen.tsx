"use client";

import type { SpeechSession } from "@spin-and-speak/domain";
import { ISSUE_LABELS } from "@/lib/labels";

const CATEGORIES: Array<[keyof SpeechSession["scores"], string]> = [
  ["structure", "Structure"], ["content", "Content"], ["clarity", "Clarity"], ["fluency", "Fluency"], ["delivery", "Delivery"]
];

export function ResultsScreen({ session, onProgress }: { session: SpeechSession; onProgress: () => void }) {
  const improved = session.improvedIssues[0];
  const repeated = session.persistentIssues[0] ?? session.repeatedIssues[0];
  const timeNote = session.metrics.timeManagement === "finished_too_early"
    ? `You stopped at about ${session.metrics.speakingDurationSeconds.toFixed(0)} seconds. Try to develop your ideas closer to the full minute.`
    : session.metrics.timeManagement === "unfinished_at_60"
      ? "You were still developing your point at 60 seconds. Plan a clear finish before time runs out."
      : null;

  return (
    <main className="screen results-screen">
      <section className="score-splash">
        <p className="eyebrow light">Your score</p>
        <div className="big-score">{session.scores.overall.toFixed(1)}</div>
        <span>out of 10</span>
      </section>

      <div className="category-grid">
        {CATEGORIES.map(([key, label]) => (
          <div className="category-score" key={key}>
            <span>{label}</span><strong>{session.scores[key].toFixed(1)}</strong>
          </div>
        ))}
      </div>

      <section className="feedback-card good-card">
        <h2>✓ What went well</h2>
        <p>{session.strengths[0]}</p>
        <p>{session.strengths[1]}</p>
        {improved && <p className="feedback-evidence"><strong>Improving:</strong> {ISSUE_LABELS[improved]} is getting better.</p>}
      </section>
      <section className="feedback-card bad-card">
        <h2>↑ What to improve</h2>
        <p>{session.improvements[0]}</p>
        <p>{session.improvements[1]}</p>
        {repeated && <p className="feedback-evidence"><strong>Keep working on this:</strong> {ISSUE_LABELS[repeated]} has shown up again in recent speeches.</p>}
        {session.issueTags.includes("too_many_fillers") && <p className="feedback-evidence"><strong>Filler count:</strong> {session.metrics.fillerCount}</p>}
        {timeNote && <p className="feedback-evidence"><strong>Time:</strong> {timeNote}</p>}
      </section>
      <section className="feedback-card focus-card">
        <h2>Next-time focus</h2>
        <p>{session.nextFocus}</p>
      </section>

      <button className="primary-button wide strong-cta" onClick={onProgress}>See my progress →</button>
    </main>
  );
}
