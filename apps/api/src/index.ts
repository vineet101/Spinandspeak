import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { installRouter } from "./routes/install.js";
import { topicsRouter } from "./routes/topics.js";
import { speechRouter } from "./routes/speech.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, mockAi: config.mockAi, rubricVersion: config.RUBRIC_VERSION });
});
app.use("/v1/install", installRouter);
app.use("/v1/topics", topicsRouter);
app.use("/v1/speech", speechRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (config.NODE_ENV !== "production") console.error(error);
  else console.error(`[api-error] ${message.slice(0, 180)}`);
  res.status(500).json({ error: "Something went wrong while processing the request.", code: "SERVER_ERROR" });
});

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Spin & Speak API listening on port ${config.PORT}${config.mockAi ? " (MOCK_AI)" : ""}`);
});
