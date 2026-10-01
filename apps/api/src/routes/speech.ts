import { Router } from "express";
import multer from "multer";
import { analyseSpeechMetadataSchema } from "@spin-and-speak/api-types";
import { config } from "../config.js";
import { requireInstallToken } from "../middleware/auth.js";
import { limitByInstall, limitGlobal } from "../middleware/rateLimit.js";
import { analyseSpeech } from "../services/speechService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxAudioBytes, files: 1 }
});

const cache = new Map<string, { expiresAt: number; result: unknown }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
}, 15 * 60 * 1000).unref();

export const speechRouter = Router();
speechRouter.post(
  "/analyse",
  requireInstallToken,
  limitByInstall({ name: "speech", max: config.MAX_SPEECHES_PER_DAY, windowMs: 24 * 60 * 60 * 1000 }),
  limitGlobal({ name: "speech", max: config.MAX_GLOBAL_SPEECHES_PER_DAY, windowMs: 24 * 60 * 60 * 1000 }),
  upload.single("audio"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Audio file is required.", code: "AUDIO_MISSING" });
        return;
      }
      if (!/^audio\/(webm|ogg|wav|x-wav|mp4|m4a|mpeg)/i.test(req.file.mimetype)) {
        res.status(415).json({ error: "Unsupported audio format.", code: "AUDIO_FORMAT" });
        return;
      }
      let raw: unknown;
      try { raw = JSON.parse(String(req.body.metadata ?? "{}")); }
      catch { raw = {}; }
      const parsed = analyseSpeechMetadataSchema.safeParse(raw);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid speech metadata.", code: "BAD_REQUEST" });
        return;
      }
      if (parsed.data.rubricVersion !== config.RUBRIC_VERSION) {
        res.status(409).json({ error: "The app scoring version is out of date. Refresh the app and try again.", code: "RUBRIC_MISMATCH" });
        return;
      }
      const cached = cache.get(parsed.data.sessionAttemptId);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.result);
        return;
      }
      const result = await analyseSpeech(req.file.buffer, req.file.mimetype, parsed.data);
      cache.set(parsed.data.sessionAttemptId, { expiresAt: Date.now() + 60 * 60 * 1000, result });
      res.json(result);
    } catch (error) { next(error); }
  }
);
