import { Router } from "express";
import { z } from "zod";
import { createLogger, toErrorContext } from "../lib/logger.js";
import { getMarketFlowDashboard } from "../services/marketFlowEngine.js";
import { CHART_RANGES, DEFAULT_CHART_RANGE, readMarketFlowHistory, readMarketFlowLatest, readThemeRotationHistory } from "../services/marketFlowStorage.js";

export const marketFlowRoutes = Router();
const logger = createLogger("marketFlowRoutes");

const forceRefreshQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional().default(false)
});

const rangeQuerySchema = z.object({
  range: z.enum(CHART_RANGES).optional().default(DEFAULT_CHART_RANGE)
});

const themeHistoryQuerySchema = z.object({
  range: z.enum(CHART_RANGES).optional().default(DEFAULT_CHART_RANGE),
  themes: z.string().optional()
});

marketFlowRoutes.get("/market-flow", async (request, response, next) => {
  try {
    const query = forceRefreshQuerySchema.parse(request.query);
    const payload = await getMarketFlowDashboard({
      forceRefresh: query.forceRefresh
    });
    logger.info("market-flow:get:success", {
      forceRefresh: query.forceRefresh,
      marketMode: payload.marketMode,
      globalState: payload.global.state,
      localState: payload.local.state,
      themeCount: payload.themeRotation.themeCount
    });
    response.json(payload);
  } catch (error) {
    logger.error("market-flow:get:failed", toErrorContext(error));
    next(error);
  }
});

marketFlowRoutes.get("/market-flow/latest", async (_request, response, next) => {
  try {
    const payload = await readMarketFlowLatest();
    response.json(payload);
  } catch (error) {
    logger.error("market-flow-latest:get:failed", toErrorContext(error));
    next(error);
  }
});

marketFlowRoutes.get("/market-flow/history", async (request, response, next) => {
  try {
    const query = rangeQuerySchema.parse(request.query);
    const payload = await readMarketFlowHistory(query.range);
    response.json(payload);
  } catch (error) {
    logger.error("market-flow-history:get:failed", toErrorContext(error));
    next(error);
  }
});

marketFlowRoutes.get("/market-flow/themes/history", async (request, response, next) => {
  try {
    const query = themeHistoryQuerySchema.parse(request.query);
    const themes = query.themes
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const payload = await readThemeRotationHistory(query.range, themes);
    response.json(payload);
  } catch (error) {
    logger.error("theme-rotation-history:get:failed", toErrorContext(error));
    next(error);
  }
});

marketFlowRoutes.post("/market-flow/refresh", async (_request, response, next) => {
  try {
    const payload = await getMarketFlowDashboard({
      forceRefresh: true
    });
    logger.info("market-flow:refresh:success", {
      marketMode: payload.marketMode,
      globalState: payload.global.state,
      localState: payload.local.state,
      themeCount: payload.themeRotation.themeCount
    });
    response.json({
      ok: true,
      ...payload
    });
  } catch (error) {
    logger.error("market-flow:refresh:failed", toErrorContext(error));
    next(error);
  }
});
