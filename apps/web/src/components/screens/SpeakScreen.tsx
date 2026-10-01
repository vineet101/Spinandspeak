"use client";

import { useEffect, useRef, useState } from "react";
import { playBell, playStopTone } from "@/lib/audioCues";

export function SpeakScreen({
  topic,
  micLevel,
  onComplete
}: {
  topic: string;
  micLevel: number;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(60);
  const cues = useRef(new Set<number>());
  const done = useRef(false);
  useEffect(() => {
    const deadline = performance.now() + 60_000;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setRemaining(next);
      if ((next === 10 || next === 5) && !cues.current.has(next)) {
        cues.current.add(next); playBell();
      }
      if (next === 0 && !done.current) {
        done.current = true;
        clearInterval(timer);
        onComplete();
        playStopTone();
      }
    }, 80);
    return () => clearInterval(timer);
  }, [onComplete]);

  const bars = Array.from({ length: 12 }, (_, i) => Math.max(0.08, Math.min(1, micLevel * (0.55 + ((i * 17) % 9) / 10))));
  return (
    <main className="screen timer-screen speak-screen">
      <div className="recording-chip"><span className="recording-dot" /> Recording</div>
      <p className="speak-topic">{topic}</p>
      <div className="speak-timer" aria-live="polite">
        <strong>{remaining}</strong>
        <span>seconds remaining</span>
      </div>
      <div className="mic-meter" aria-label="Microphone level">
        {bars.map((height, i) => <span key={i} style={{ height: `${Math.round(height * 46)}px` }} />)}
      </div>
      <div className="cue-note speak-cue">Bell at 10 sec left · Bell at 5 sec left · Stops at 0</div>
    </main>
  );
}
