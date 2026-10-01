import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export interface AuthenticatedRequest extends Request {
  installId?: string;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", config.installTokenSecret).update(payload).digest("base64url");
}

export function createInstallToken(): string {
  const payload = Buffer.from(JSON.stringify({
    installId: crypto.randomUUID(),
    issuedAt: Date.now()
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { installId?: string };
    return typeof decoded.installId === "string" ? decoded.installId : null;
  } catch {
    return null;
  }
}

export function requireInstallToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing installation token.", code: "AUTH_MISSING" });
    return;
  }
  const installId = verifyToken(header.slice(7));
  if (!installId) {
    res.status(401).json({ error: "Invalid installation token.", code: "AUTH_INVALID" });
    return;
  }
  req.installId = installId;
  next();
}
