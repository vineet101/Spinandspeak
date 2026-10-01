"use client";

import type { GenerateTopicResponse } from "@spin-and-speak/api-types";
import { LEVEL_LABELS } from "@spin-and-speak/domain";

export function TopicScreen({
  topic,
  skipUsed,
  onSkip,
  onAccept,
  onBack,
  busy,
  error
}: {
  topic: GenerateTopicResponse;
  skipUsed: boolean;
  onSkip: () => void;
  onAccept: () => void;
  onBack: () => void;
  busy: boolean;
  error?: string;
}) {
  return (
    <main className="screen topic-screen">
      <button className="text-button top-left" onClick={onBack} disabled={busy}>← Home</button>
      <section className="hero-copy topic-heading">
        <p className="eyebrow">Today’s topic</p>
        <h1>Here we go.</h1>
      </section>

      <section className="topic-card">
        <span className="level-pill">Level {topic.level} · {LEVEL_LABELS[topic.level]}</span>
        <p className="topic-text">{topic.topic}</p>
      </section>

      <p className="skip-rule">
        {skipUsed ? "This is your second topic, so this one must be accepted." : "You may skip once. The second topic must be accepted."}
      </p>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="button-stack">
        {!skipUsed && (
          <button className="secondary-button wide" onClick={onSkip} disabled={busy}>
            {busy ? "Finding another…" : "Skip once"}
          </button>
        )}
        <button className="primary-button wide" onClick={onAccept} disabled={busy}>
          {busy ? "Getting microphone ready…" : "Accept topic"}
        </button>
      </div>

      <section className="how-it-works">
        <h2>How it works</h2>
        <div className="how-row">
          <div><strong>30 sec</strong><span>Think</span></div>
          <div className="how-arrow">→</div>
          <div><strong>1 min</strong><span>Speak</span></div>
        </div>
        <p>You’ll be scored on 5 things:</p>
        <strong>Structure · Content · Clarity · Fluency · Delivery</strong>
      </section>
    </main>
  );
}
