"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Checking your structure",
  "Counting fillers and pauses",
  "Reviewing your delivery",
  "Listening to pronunciation",
  "Putting your feedback together"
];

export function ScoringScreen({
  error,
  invalidReason,
  onRetryScore,
  onRetrySpeech,
  onDiscard
}: {
  error?: string;
  invalidReason?: string;
  onRetryScore: () => void;
  onRetrySpeech: () => void;
  onDiscard: () => void;
}) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (error || invalidReason) return;
    const timer = setInterval(() => setStage((value) => Math.min(STAGES.length - 1, value + 1)), 1300);
    return () => clearInterval(timer);
  }, [error, invalidReason]);

  if (invalidReason) {
    return (
      <main className="screen scoring-screen centered-screen">
        <div className="status-icon bad">↻</div>
        <h1>We couldn’t score that one fairly.</h1>
        <p>{invalidReason}</p>
        <button className="primary-button wide" onClick={onRetrySpeech}>Try the speech again</button>
        <button className="text-button" onClick={onDiscard}>Back to home</button>
      </main>
    );
  }

  if (error) {
    return (
      <main className="screen scoring-screen centered-screen">
        <div className="status-icon warning">!</div>
        <h1>Your recording is safe.</h1>
        <p>We couldn’t send it for scoring yet. You do not need to give the speech again.</p>
        <div className="error-banner">{error}</div>
        <button className="primary-button wide" onClick={onRetryScore}>Try scoring again</button>
        <button className="text-button" onClick={onDiscard}>Discard recording</button>
      </main>
    );
  }

  return (
    <main className="screen scoring-screen">
      <div className="score-orbit" aria-hidden="true"><span /><span /><span /></div>
      <p className="eyebrow">Scoring…</p>
      <h1>Your score is coming…</h1>
      <div className="stage-list">
        {STAGES.map((item, index) => (
          <div key={item} className={`stage-item ${index < stage ? "done" : index === stage ? "active" : ""}`}>
            <span>{index < stage ? "✓" : index === stage ? "•" : "○"}</span>
            {item}
          </div>
        ))}
      </div>
      <p className="quiet-note">This normally takes just a few seconds.</p>
    </main>
  );
}
