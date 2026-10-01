import { Router } from "express";
import { generateTopicRequestSchema } from "@spin-and-speak/api-types";
import { config } from "../config.js";
import { requireInstallToken } from "../middleware/auth.js";
import { limitByInstall } from "../middleware/rateLimit.js";
import { createTopic } from "../services/topicService.js";

export const topicsRouter = Router();
topicsRouter.post(
  "/generate",
  requireInstallToken,
  limitByInstall({ name: "topics", max: config.MAX_TOPICS_PER_HOUR, windowMs: 60 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const parsed = generateTopicRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid topic request.", code: "BAD_REQUEST" });
        return;
      }
      res.json(await createTopic(parsed.data));
    } catch (error) { next(error); }
  }
);
