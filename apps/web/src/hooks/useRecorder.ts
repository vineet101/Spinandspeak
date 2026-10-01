"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm"
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

export function useRecorder() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [level, setLevel] = useState(0);
  const [prepared, setPrepared] = useState(false);

  const prepare = useCallback(async () => {
    if (streamRef.current?.active) { setPrepared(true); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This browser does not support microphone recording.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      video: false
    });
    streamRef.current = stream;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) { const centered = (value - 128) / 128; sum += centered * centered; }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 5));
      animationRef.current = requestAnimationFrame(tick);
    };
    tick();
    setPrepared(true);
  }, []);

  const start = useCallback(() => {
    const stream = streamRef.current;
    if (!stream?.active) throw new Error("Microphone is not ready.");
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      resolveStopRef.current?.(blob);
      resolveStopRef.current = null;
    };
    recorder.start(250);
  }, []);

  const stop = useCallback(async (): Promise<Blob> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") throw new Error("Recording is not running.");
    return new Promise<Blob>((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const release = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setLevel(0);
    setPrepared(false);
  }, []);

  useEffect(() => release, [release]);

  return { prepare, start, stop, release, level, prepared };
}
