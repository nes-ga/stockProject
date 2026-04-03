import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alertRoutes } from "./routes/alertRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { bandRoutes } from "./routes/bandRoutes.js";
import { analysisRoutes } from "./routes/analysisRoutes.js";

export const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
const lightweightChartsDir = path.resolve(currentDir, "../node_modules/lightweight-charts/dist");

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

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  response.status(500).json({ error: message });
});
