"use client";

import type { ChildProfile } from "@spin-and-speak/domain";
import { LEVEL_LABELS } from "@spin-and-speak/domain";

export function HomeScreen({
  profile,
  onTopic,
  onProgress,
  onSwitchProfile,
  loadingTopic
}: {
  profile: ChildProfile;
  onTopic: () => void;
  onProgress: () => void;
  onSwitchProfile: () => void;
  loadingTopic: boolean;
}) {
  const atTop = profile.currentLevel === 5;
  const progress = atTop ? 3 : profile.levelUpStreak;
  return (
    <main className="screen home-screen">
      <section className="home-name-block">
        <button className="text-button" onClick={onSwitchProfile} aria-label="Back to player selection">← Players</button>
        <h1>{profile.name}</h1>
      </section>

      <section className="level-card">
        <div className="level-row">
          <div>
            <span className="eyebrow">Current level</span>
            <h2>Level {profile.currentLevel} · {LEVEL_LABELS[profile.currentLevel]}</h2>
          </div>
        </div>
        <div className="unlock-line">
          <span className="level-chip">L{profile.currentLevel}</span>
          <div className="unlock-track" aria-label={`${progress} of 3 strong speeches`}>
            {[0, 1, 2].map((n) => <span key={n} className={n < progress ? "filled" : ""} />)}
          </div>
          <span className="level-chip muted">{atTop ? "★" : `L${profile.currentLevel + 1} 🔒`}</span>
        </div>
        <p className="level-copy">
          {atTop
            ? "You’ve reached Level 5. Keep building consistency."
            : profile.levelUpStreak === 0
              ? "Three 8+ speeches in a row unlock the next level."
              : `${profile.levelUpStreak} strong speech${profile.levelUpStreak === 1 ? "" : "es"} in a row. ${3 - profile.levelUpStreak} more unlock${3 - profile.levelUpStreak === 1 ? "s" : ""} Level ${profile.currentLevel + 1}.`}
        </p>
      </section>

      <button className="primary-button giant" onClick={onTopic} disabled={loadingTopic}>
        <span>{loadingTopic ? "Spinning a topic…" : "Show me today’s topic"}</span>
        <span aria-hidden="true">→</span>
      </button>
      <button className="secondary-button wide" onClick={onProgress}>See my progress</button>
    </main>
  );
}
