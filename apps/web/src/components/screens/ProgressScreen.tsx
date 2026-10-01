"use client";

import type { ChildProfile, SpeechSession } from "@spin-and-speak/domain";
import { LEVEL_LABELS } from "@spin-and-speak/domain";
import { ISSUE_LABELS } from "@/lib/labels";

function improvementText(sessions: SpeechSession[]): string {
  const latest = sessions[0];
  if (!latest) return "Complete your first speech to start seeing progress.";
  if (latest.improvedIssues[0]) return `Getting better at ${ISSUE_LABELS[latest.improvedIssues[0]]}.`;
  const last3 = sessions.slice(0, 3);
  if (last3.length >= 2 && last3[0] && last3[last3.length - 1]) {
    const newest = last3[0].metrics.fillerCount;
    const oldest = last3[last3.length - 1]!.metrics.fillerCount;
    if (newest < oldest) return `Filler words are moving down: ${oldest} → ${newest}.`;
  }
  return "Every completed speech is building a stronger baseline.";
}

function workingText(sessions: SpeechSession[]): string {
  const latest = sessions[0];
  if (!latest) return "No recurring issue yet.";
  const tag = latest.persistentIssues[0] ?? latest.repeatedIssues[0];
  return tag ? `${ISSUE_LABELS[tag]} is still showing up in recent speeches.` : "No repeated issue is showing up right now.";
}

export function ProgressScreen({
  profile,
  sessions,
  onSpeech,
  onHome
}: {
  profile: ChildProfile;
  sessions: SpeechSession[];
  onSpeech: (session: SpeechSession) => void;
  onHome: () => void;
}) {
  const latest = sessions[0];
  const last5 = sessions.slice(0, 5).reverse();
  const atTop = profile.currentLevel === 5;
  return (
    <main className="screen progress-screen">
      <header className="progress-title">
        <p className="eyebrow">My progress</p>
        <h1>Getting stronger</h1>
      </header>

      <section className="level-card compact">
        <div className="level-row">
          <div><span className="eyebrow">Current level</span><h2>Level {profile.currentLevel} · {LEVEL_LABELS[profile.currentLevel]}</h2></div>
        </div>
        <div className="unlock-line">
          <span className="level-chip">L{profile.currentLevel}</span>
          <div className="unlock-track">
            {[0, 1, 2].map((n) => <span key={n} className={n < (atTop ? 3 : profile.levelUpStreak) ? "filled" : ""} />)}
          </div>
          <span className="level-chip muted">{atTop ? "★" : `L${profile.currentLevel + 1} 🔒`}</span>
        </div>
        <p className="level-copy">{atTop ? "Level 5 unlocked." : profile.levelUpStreak ? `${profile.levelUpStreak} strong speech${profile.levelUpStreak > 1 ? "es" : ""} in a row. ${3 - profile.levelUpStreak} more to unlock Level ${profile.currentLevel + 1}.` : `Three 8+ speeches in a row unlock Level ${profile.currentLevel + 1}.`}</p>
      </section>

      <section className="latest-score-card">
        <span>Latest score</span>
        {latest ? <button onClick={() => onSpeech(latest)}>{latest.scores.overall.toFixed(1)} <small>›</small></button> : <strong>-</strong>}
      </section>

      <section className="chart-card">
        <h2>Last 5 speeches</h2>
        {last5.length ? (
          <>
            <div className="bar-chart" role="img" aria-label="Scores for the last five speeches">
              {last5.map((session) => (
                <button key={session.id} className="bar-slot" onClick={() => onSpeech(session)} aria-label={`Score ${session.scores.overall.toFixed(1)}`}>
                  <span className="bar-fill" style={{ height: `${Math.max(8, session.scores.overall * 10)}%` }}>
                    <strong>{session.scores.overall.toFixed(1)}</strong>
                  </span>
                </button>
              ))}
            </div>
            <p className="tap-hint">Tap any speech to see its feedback</p>
          </>
        ) : <p className="empty-copy">Your scores will appear here after your first speech.</p>}
      </section>

      <section className="feedback-card good-card"><h2>↗ Improving</h2><p>{improvementText(sessions)}</p></section>
      <section className="feedback-card bad-card"><h2>→ Still working on</h2><p>{workingText(sessions)}</p></section>

      <button className="primary-button wide strong-cta" onClick={onHome}>Back to Home</button>
    </main>
  );
}
