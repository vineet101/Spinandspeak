import { Router } from "express";
import { createInstallToken } from "../middleware/auth.js";
import { limitByInstall } from "../middleware/rateLimit.js";
import { config } from "../config.js";

export const installRouter = Router();
installRouter.post("/register", limitByInstall({ name: "install-register", max: config.MAX_INSTALLS_PER_HOUR, windowMs: 60 * 60 * 1000 }), (_req, res) => {
  res.json({ installToken: createInstallToken() });
});
