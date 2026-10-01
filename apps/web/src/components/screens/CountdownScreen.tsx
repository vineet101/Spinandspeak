"use client";

import { useEffect, useState } from "react";
import { speakCue } from "@/lib/audioCues";

export function CountdownScreen({ topic, onComplete }: { topic: string; onComplete: () => void }) {
  const [step, setStep] = useState(3);
  useEffect(() => {
    speakCue("3");
    const t1 = setTimeout(() => { setStep(2); speakCue("2"); }, 1000);
    const t2 = setTimeout(() => { setStep(1); speakCue("1"); }, 2000);
    const t3 = setTimeout(() => { setStep(0); speakCue("Start"); }, 3000);
    const t4 = setTimeout(() => { onComplete(); }, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);
  return (
    <main className="screen countdown-screen">
      <p className="eyebrow">Your topic</p>
      <p className="countdown-topic">{topic}</p>
      <div className="start-count">{step === 0 ? "START" : step}</div>
    </main>
  );
}
