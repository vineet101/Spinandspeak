import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import type { PitchVariation, VolumeAssessment } from "@spin-and-speak/domain";

export interface ObjectiveAudioMetrics {
  durationSeconds: number;
  speakingDurationSeconds: number;
  voicedSeconds: number;
  percentWindowSpoken: number;
  longPauseCount: number;
  longPauseDurationSeconds: number;
  relativeLoudnessDb: number;
  volumeAssessment: VolumeAssessment;
  pitchVariation: PitchVariation;
  pitchRangeSemitones: number;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-500)}`)));
  });
}

function parsePcm16Wav(buffer: Buffer): { samples: Float32Array; sampleRate: number; duration: number } {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Converted audio is not a WAV file.");
  }
  let offset = 12;
  let sampleRate = 16000;
  let channels = 1;
  let bits = 16;
  let dataOffset = -1;
  let dataLength = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bits = buffer.readUInt16LE(start + 14);
    } else if (id === "data") {
      dataOffset = start;
      dataLength = Math.min(size, buffer.length - start);
      break;
    }
    offset = start + size + (size % 2);
  }
  if (dataOffset < 0 || bits !== 16 || channels !== 1) throw new Error("Expected mono 16-bit PCM WAV.");
  const sampleCount = Math.floor(dataLength / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768;
  return { samples, sampleRate, duration: sampleCount / sampleRate };
}

function dbfs(rms: number): number {
  return rms <= 1e-8 ? -100 : 20 * Math.log10(rms);
}

function estimatePitch(frame: Float32Array, sampleRate: number): number | null {
  let mean = 0;
  for (const v of frame) mean += v;
  mean /= frame.length;
  const centered = new Float32Array(frame.length);
  let energy = 0;
  for (let i = 0; i < frame.length; i++) {
    const value = (frame[i] ?? 0) - mean;
    centered[i] = value;
    energy += value * value;
  }
  if (energy / frame.length < 0.00002) return null;
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(Math.floor(sampleRate / 70), frame.length - 2);
  let bestLag = 0;
  let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0; let d1 = 0; let d2 = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      const a = centered[i] ?? 0;
      const b = centered[i + lag] ?? 0;
      num += a * b; d1 += a * a; d2 += b * b;
    }
    const corr = num / (Math.sqrt(d1 * d2) || 1);
    if (corr > bestCorrelation) { bestCorrelation = corr; bestLag = lag; }
  }
  return bestCorrelation >= 0.35 && bestLag ? sampleRate / bestLag : null;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx] ?? 0;
}

function analyseWav(buffer: Buffer): ObjectiveAudioMetrics {
  const { samples, sampleRate, duration } = parsePcm16Wav(buffer);
  const frameSeconds = 0.02;
  const frameSize = Math.max(1, Math.floor(sampleRate * frameSeconds));
  const frameDb: number[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let sum = 0;
    for (let i = start; i < start + frameSize; i++) {
      const value = samples[i] ?? 0; sum += value * value;
    }
    frameDb.push(dbfs(Math.sqrt(sum / frameSize)));
  }
  const isCueWindow = (seconds: number) =>
    (seconds >= 49.65 && seconds <= 50.55) || (seconds >= 54.65 && seconds <= 55.55);
  const voiced = frameDb.map((value, index) => value > -42 && !isCueWindow(index * frameSeconds));
  const firstVoice = voiced.findIndex(Boolean);
  let lastVoice = -1;
  for (let i = voiced.length - 1; i >= 0; i--) if (voiced[i]) { lastVoice = i; break; }
  const voicedFrames = voiced.filter(Boolean).length;
  const voicedSeconds = voicedFrames * frameSeconds;
  const speakingDurationSeconds = lastVoice >= 0 ? Math.min(duration, (lastVoice + 1) * frameSeconds) : 0;
  const voicedDb = frameDb.filter((_, i) => voiced[i]);
  const relativeLoudnessDb = voicedDb.length ? voicedDb.reduce((a, b) => a + b, 0) / voicedDb.length : -100;
  const volumeAssessment: VolumeAssessment = relativeLoudnessDb < -30 ? "too_soft" : relativeLoudnessDb > -12 ? "too_loud" : "good";

  let longPauseCount = 0;
  let longPauseDurationSeconds = 0;
  if (firstVoice >= 0 && lastVoice > firstVoice) {
    let runStart: number | null = null;
    for (let i = firstVoice; i <= lastVoice + 1; i++) {
      const isSilent = i <= lastVoice ? !voiced[i] : false;
      if (isSilent && runStart === null) runStart = i;
      if (!isSilent && runStart !== null) {
        const seconds = (i - runStart) * frameSeconds;
        if (seconds >= 2) { longPauseCount += 1; longPauseDurationSeconds += seconds; }
        runStart = null;
      }
    }
  }

  const pitches: number[] = [];
  const pitchFrameSize = Math.floor(sampleRate * 0.05);
  const pitchHop = Math.floor(sampleRate * 0.10);
  for (let start = 0; start + pitchFrameSize <= samples.length; start += pitchHop) {
    if (isCueWindow(start / sampleRate)) continue;
    const frame = samples.slice(start, start + pitchFrameSize);
    let sum = 0; for (const v of frame) sum += v * v;
    if (dbfs(Math.sqrt(sum / frame.length)) < -38) continue;
    const hz = estimatePitch(frame, sampleRate);
    if (hz && hz >= 70 && hz <= 400) pitches.push(hz);
  }
  const semitones = pitches.map((hz) => 12 * Math.log2(hz / 100));
  const pitchRangeSemitones = semitones.length >= 4 ? Math.max(0, percentile(semitones, 0.9) - percentile(semitones, 0.1)) : 0;
  const pitchVariation: PitchVariation = pitchRangeSemitones < 3.5 ? "low" : pitchRangeSemitones > 14 ? "high" : "good";

  return {
    durationSeconds: Math.round(duration * 10) / 10,
    speakingDurationSeconds: Math.round(speakingDurationSeconds * 10) / 10,
    voicedSeconds: Math.round(voicedSeconds * 10) / 10,
    percentWindowSpoken: Math.round((voicedSeconds / Math.max(1, Math.min(duration, 60))) * 1000) / 10,
    longPauseCount,
    longPauseDurationSeconds: Math.round(longPauseDurationSeconds * 10) / 10,
    relativeLoudnessDb: Math.round(relativeLoudnessDb * 10) / 10,
    volumeAssessment,
    pitchVariation,
    pitchRangeSemitones: Math.round(pitchRangeSemitones * 10) / 10
  };
}

export async function convertAndMeasureAudio(input: Buffer, extension: string): Promise<{ wav: Buffer; metrics: ObjectiveAudioMetrics }> {
  if (!ffmpegPath) throw new Error("ffmpeg binary is unavailable.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "spin-speak-"));
  const inputPath = path.join(dir, `input.${extension}`);
  const outputPath = path.join(dir, "audio.wav");
  try {
    await writeFile(inputPath, input);
    await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outputPath]);
    const wav = await readFile(outputPath);
    return { wav, metrics: analyseWav(wav) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
