import { Router } from "express";
import { z } from "zod";
import { createLogger, toErrorContext } from "../lib/logger.js";
import {
  deletePortfolioHolding,
  getPortfolioAdvice,
  getPortfolioDataSource,
  getPortfolioHoldings,
  getPortfolioQuotes,
  savePortfolioAccount,
  savePortfolioHoldings,
  upsertPortfolioHolding
} from "../services/portfolio/portfolioManager.js";
import { parsePortfolioScreenshotWithLocalOcr } from "../services/portfolio/localOcrReader.js";
import { parsePortfolioScreenshot } from "../services/portfolio/screenshotReader.js";

const logger = createLogger("portfolioRoutes");
export const portfolioRoutes = Router();
const LOCAL_OCR_PARSER_VERSION = "2026-08-19.5";

const originalIntentSchema = z.enum(["SWING", "LONG_TERM", "UNKNOWN"]);

const portfolioHoldingSchema = z.object({
  id: z.string().min(1).optional(),
  symbol: z.string().min(1),
  name: z.string().min(1),
  avgPrice: z.coerce.number().positive(),
  currentPrice: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().positive(),
  investedAmount: z.coerce.number().min(0).optional(),
  evaluationAmount: z.coerce.number().min(0).optional(),
  profitRate: z.coerce.number().optional(),
  originalIntent: originalIntentSchema.default("UNKNOWN"),
  openedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceRecommendationId: z.string().min(1).optional(),
  memo: z.string().max(1000).optional()
});

const portfolioHoldingBatchSchema = z.object({
  items: z.array(portfolioHoldingSchema),
  account: z
    .object({
      brokerName: z.string().max(100).optional(),
      accountLabel: z.string().max(100).optional(),
      cashBalance: z.coerce.number().min(0).optional(),
      buyingPower: z.coerce.number().min(0).optional(),
      totalInvestedAmount: z.coerce.number().min(0).optional(),
      totalEvaluationAmount: z.coerce.number().min(0).optional(),
      totalProfitAmount: z.coerce.number().optional(),
      totalProfitRate: z.coerce.number().optional()
    })
    .optional()
});

const portfolioScreenshotParseSchema = z.object({
  imageDataUrl: z.string().min(100),
  fileName: z.string().max(255).optional()
});

function normalizeHoldingInput(input: z.infer<typeof portfolioHoldingSchema>) {
  return {
    ...input,
    currentPrice: input.currentPrice ?? input.avgPrice,
    id: input.id ?? `${input.symbol}:${input.openedDate ?? "manual"}`
  };
}

portfolioRoutes.get("/holdings", async (_request, response, next) => {
  try {
    const items = await getPortfolioHoldings();
    response.json({
      count: items.length,
      dataSource: getPortfolioDataSource(),
      items
    });
  } catch (error) {
    logger.error("holdings:get:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.post("/holdings", async (request, response, next) => {
  try {
    const input = portfolioHoldingBatchSchema.parse(request.body);
    const items = await savePortfolioHoldings(input.items.map(normalizeHoldingInput));
    const account = input.account
      ? await savePortfolioAccount({
          ...input.account,
          source: "screenshot",
          capturedAt: new Date().toISOString()
        })
      : undefined;
    response.json({
      ok: true,
      count: items.length,
      dataSource: getPortfolioDataSource(),
      items,
      account
    });
  } catch (error) {
    logger.error("holdings:save:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.put("/holdings/:id", async (request, response, next) => {
  try {
    const input = portfolioHoldingSchema.parse({
      ...request.body,
      id: request.params.id
    });
    const items = await upsertPortfolioHolding(normalizeHoldingInput(input));
    response.json({
      ok: true,
      count: items.length,
      dataSource: getPortfolioDataSource(),
      items
    });
  } catch (error) {
    logger.error("holdings:upsert:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.delete("/holdings/:id", async (request, response, next) => {
  try {
    const result = await deletePortfolioHolding(request.params.id);
    response.json({
      ok: true,
      dataSource: getPortfolioDataSource(),
      ...result
    });
  } catch (error) {
    logger.error("holdings:delete:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.get("/advice", async (_request, response, next) => {
  try {
    response.json(await getPortfolioAdvice());
  } catch (error) {
    logger.error("advice:get:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.get("/quotes", async (_request, response, next) => {
  try {
    response.json(await getPortfolioQuotes());
  } catch (error) {
    logger.error("quotes:get:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.post("/screenshot/parse", async (request, response, next) => {
  try {
    const input = portfolioScreenshotParseSchema.parse(request.body);
    const result = await parsePortfolioScreenshot(input.imageDataUrl);
    response.json({
      ok: true,
      fileName: input.fileName,
      ...result
    });
  } catch (error) {
    logger.error("screenshot:parse:failed", toErrorContext(error));
    next(error);
  }
});

portfolioRoutes.post("/screenshot/ocr-local", async (request, response, next) => {
  try {
    const input = portfolioScreenshotParseSchema.parse(request.body);
    const result = await parsePortfolioScreenshotWithLocalOcr(input.imageDataUrl);
    response.json({
      ok: true,
      parser: "local_ocr",
      parserVersion: LOCAL_OCR_PARSER_VERSION,
      fileName: input.fileName,
      ...result
    });
  } catch (error) {
    logger.error("screenshot:ocr-local:failed", toErrorContext(error));
    next(error);
  }
});
