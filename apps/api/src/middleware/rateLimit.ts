import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.js";

type WindowKey = string;
interface Counter { count: number; resetAt: number }
const counters = new Map<WindowKey, Counter>();

export function limitByInstall(options: {
  name: string;
  max: number;
  windowMs: number;
}) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const id = req.installId ?? req.ip ?? "unknown";
    const key = `${options.name}:${id}`;
    const now = Date.now();
    const current = counters.get(key);
    if (!current || current.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (current.count >= options.max) {
      res.status(429).json({
        error: "Usage limit reached. Please try again later.",
        code: "RATE_LIMIT"
      });
      return;
    }
    current.count += 1;
    next();
  };
}

export function limitGlobal(options: {
  name: string;
  max: number;
  windowMs: number;
}) {
  return (_req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = `global:${options.name}`;
    const now = Date.now();
    const current = counters.get(key);
    if (!current || current.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (current.count >= options.max) {
      res.status(429).json({ error: "The app-wide usage limit has been reached. Please try again later.", code: "GLOBAL_RATE_LIMIT" });
      return;
    }
    current.count += 1;
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of counters) {
    if (value.resetAt <= now) counters.delete(key);
  }
}, 15 * 60 * 1000).unref();
