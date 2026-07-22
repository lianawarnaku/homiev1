import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── CORS ─────────────────────────────────────────────────────────────
// Restrict browser origins to an explicit allowlist. Requests with no
// Origin header (native mobile apps, curl, server-to-server) are always
// allowed — CORS only guards browser cross-origin requests.
//
// Configure via ALLOWED_ORIGINS (comma-separated). In production an unset
// list means "no cross-origin browser access". In dev we fall back to the
// local Expo web ports so `pnpm dev` keeps working.
const DEV_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:19006",
];
const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : DEV_ORIGINS;

if (configuredOrigins.length === 0 && process.env.NODE_ENV === "production") {
  logger.warn(
    "[cors] ALLOWED_ORIGINS is unset in production — all cross-origin browser requests will be blocked.",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
