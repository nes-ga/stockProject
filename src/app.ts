import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRoutes } from "./routes/authRoutes.js";
import { bandRoutes } from "./routes/bandRoutes.js";
import { analysisRoutes } from "./routes/analysisRoutes.js";

export const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
const lightweightChartsDir = path.resolve(currentDir, "../node_modules/lightweight-charts/dist");

app.use(express.json());
app.use(express.static(publicDir));
app.use("/vendor/lightweight-charts", express.static(lightweightChartsDir));

app.get("/health", (_request, response) => {
  response.json({
    ok: true
  });
});

app.get("/", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.use("/auth", authRoutes);
app.use("/band", bandRoutes);
app.use("/analysis", analysisRoutes);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  response.status(500).json({ error: message });
});
