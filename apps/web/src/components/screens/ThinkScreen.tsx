"use client";

import { useEffect, useRef, useState } from "react";
import { playBell } from "@/lib/audioCues";

export function ThinkScreen({ topic, onComplete }: { topic: string; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(30);
  const fired = useRef(new Set<number>());
  const done = useRef(false);

  useEffect(() => {
    const deadline = performance.now() + 30_000;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setRemaining(next);
      if ((next === 10 || next === 5) && !fired.current.has(next)) {
        fired.current.add(next); playBell();
      }
      if (next === 0 && !done.current) {
        done.current = true;
        clearInterval(timer);
        onComplete();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <main className="screen timer-screen think-screen">
      <div className="timer-kicker">Think</div>
      <h1>Build your idea</h1>
      <p className="timer-topic">{topic}</p>
      <div className="countdown-ring" style={{ "--progress": `${(remaining / 30) * 360}deg` } as React.CSSProperties}>
        <div className="countdown-inner">
          <strong>{remaining}</strong>
          <span>seconds</span>
        </div>
      </div>
      <p className="quiet-note">No prompts. Make the structure yours.</p>
      <div className="cue-note">Audio cue at 10 sec and 5 sec</div>
    </main>
  );
}
