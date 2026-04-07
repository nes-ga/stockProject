import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, toErrorContext } from "./lib/logger.js";
import { alertRoutes } from "./routes/alertRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { bandRoutes } from "./routes/bandRoutes.js";
import { analysisRoutes } from "./routes/analysisRoutes.js";

export const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
const lightweightChartsDir = path.resolve(currentDir, "../node_modules/lightweight-charts/dist");
const logger = createLogger("app");

function setUtf8StaticHeaders(response: express.Response, filePath: string) {
  if (filePath.endsWith(".html")) {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return;
  }

  if (filePath.endsWith(".css")) {
    response.setHeader("Content-Type", "text/css; charset=utf-8");
    return;
  }

  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  }
}

app.use(express.json());
app.use((request, response, next) => {
  const startedAt = Date.now();
  const requestId = request.header("x-request-id") || randomUUID().slice(0, 8);
  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  logger.info("request:start", {
    requestId,
    method: request.method,
    path: request.originalUrl,
    ip: request.ip
  });

  response.on("finish", () => {
    logger.info("request:finish", {
      requestId,
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});
app.use(
  express.static(publicDir, {
    setHeaders: setUtf8StaticHeaders
  })
);
app.use(
  "/vendor/lightweight-charts",
  express.static(lightweightChartsDir, {
    setHeaders: setUtf8StaticHeaders
  })
);

app.get("/health", (_request, response) => {
  response.json({
    ok: true
  });
});

app.get("/", (_request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.sendFile(path.join(publicDir, "index.html"));
});

app.use("/auth", authRoutes);
app.use("/band", bandRoutes);
app.use("/analysis", analysisRoutes);
app.use("/alerts", alertRoutes);

app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("request:error", {
    requestId: response.locals.requestId,
    method: request.method,
    path: request.originalUrl,
    ...toErrorContext(error)
  });
  response.status(500).json({
    error: message,
    requestId: response.locals.requestId
  });
});
