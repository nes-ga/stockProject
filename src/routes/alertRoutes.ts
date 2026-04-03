import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { buildSmartMoneyPatternDiscordMessages, sendDiscordMessages } from "../services/discord.js";
import { evaluateRealTimePriceSpike } from "../services/realtimeAlerts.js";
import { analyzeSmartMoneyPatterns } from "../services/stockAnalysis.js";
import {
  listSmartMoneyWatchItems,
  removeSmartMoneyWatchItem,
  updateSmartMoneyWatchScanResults,
  upsertSmartMoneyWatchItems
} from "../services/smartMoneyWatchlist.js";

export const alertRoutes = Router();

const spikeEventSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1).optional(),
  market: z.enum(["KOSPI", "KOSDAQ", "KONEX"]).optional(),
  price: z.coerce.number().positive(),
  previousClose: z.coerce.number().positive().optional(),
  changePercent: z.coerce.number().min(-100).max(1000).optional(),
  changeAmount: z.coerce.number().optional(),
  volume: z.coerce.number().nonnegative().optional(),
  volumeRatio20d: z.coerce.number().nonnegative().optional(),
  turnoverKrw: z.coerce.number().nonnegative().optional(),
  open: z.coerce.number().positive().optional(),
  high: z.coerce.number().positive().optional(),
  low: z.coerce.number().positive().optional(),
  breakout20d: z.coerce.boolean().optional(),
  breakout60d: z.coerce.boolean().optional(),
  detectedAt: z.string().optional(),
  source: z.string().min(1).max(100).optional(),
  note: z.string().min(1).max(300).optional()
});

const thresholdSchema = z
  .object({
    minChangePercent: z.coerce.number().min(0).max(100).optional(),
    minVolumeRatio: z.coerce.number().min(0).max(1000).optional(),
    minTurnoverKrw: z.coerce.number().min(0).optional(),
    requireBreakout: z.coerce.boolean().optional(),
    cooldownMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).optional()
  })
  .optional();

const priceSpikeAlertSchema = z.object({
  event: spikeEventSchema,
  thresholds: thresholdSchema,
  discord: z
    .object({
      webhookUrl: z.string().url().optional(),
      username: z.string().min(1).max(80).optional(),
      mention: z.string().min(1).max(200).optional()
    })
    .optional()
});

const smartMoneyWatchItemSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  enabled: z.coerce.boolean().optional()
});

const smartMoneyWatchBatchSchema = z.object({
  items: z.array(smartMoneyWatchItemSchema).min(1)
});

const smartMoneyScanSchema = z.object({
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  filters: z
    .object({
      lookbackTradingDays: z.coerce.number().int().min(5).max(60).optional(),
      breakoutLookbackDays: z.coerce.number().int().min(5).max(60).optional(),
      minLeadInPriceChangePercent: z.coerce.number().min(0).max(30).optional(),
      minLeadInVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minBreakoutPriceChangePercent: z.coerce.number().min(0).max(40).optional(),
      minBreakoutVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minPullbackSessions: z.coerce.number().int().min(1).max(30).optional(),
      maxPullbackSessions: z.coerce.number().int().min(1).max(30).optional(),
      maxPullbackDrawdownPercent: z.coerce.number().min(0).max(20).optional(),
      maxPullbackAvgVolumeRatio: z.coerce.number().min(0.1).max(1).optional(),
      minPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      minSetupPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      minBreakoutPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      closeNearHighRatio: z.coerce.number().min(0.9).max(1).optional(),
      recentSignalSessions: z.coerce.number().int().min(1).max(10).optional()
    })
    .optional(),
  discord: z
    .object({
      webhookUrl: z.string().url().optional(),
      username: z.string().min(1).max(80).optional(),
      mention: z.string().min(1).max(200).optional(),
      onlyActionable: z.coerce.boolean().optional().default(true)
    })
    .optional()
});

function formatNumber(value?: number, maximumFractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits
  }).format(value);
}

function formatSignal(signal: "watch" | "strong" | "explosive"): string {
  if (signal === "explosive") {
    return "폭발";
  }
  if (signal === "strong") {
    return "강함";
  }
  return "관찰";
}

function buildPriceSpikeDiscordMessage(params: {
  mention?: string;
  evaluation: ReturnType<typeof evaluateRealTimePriceSpike>;
}) {
  const { evaluation, mention } = params;
  const { event } = evaluation;
  const lines = [
    mention?.trim(),
    `실시간 급등 알람`,
    `[${event.market ?? "KOR"}] ${event.name ?? event.symbol} (${event.symbol})`,
    `가격 ${formatNumber(event.price)}원 | 등락률 ${formatNumber(event.changePercent, 2)}% | 점수 ${evaluation.score} | 신호 ${formatSignal(evaluation.signal)}`,
    `거래량 ${formatNumber(event.volume, 0)} | 거래량배수 ${formatNumber(event.volumeRatio20d)} | 거래대금 ${formatNumber((event.turnoverKrw ?? 0) / 100_000_000, 0)}억`,
    evaluation.summary
  ].filter(Boolean);

  if (event.note) {
    lines.push(`메모: ${event.note}`);
  }

  if (event.source) {
    lines.push(`source=${event.source}`);
  }

  return lines.join("\n");
}

alertRoutes.post("/price-spike", async (request, response, next) => {
  try {
    if (config.alertWebhookSecret) {
      const provided = request.header("x-alert-secret");
      if (provided !== config.alertWebhookSecret) {
        response.status(401).json({
          error: "Invalid alert secret"
        });
        return;
      }
    }

    const input = priceSpikeAlertSchema.parse(request.body);
    const evaluation = evaluateRealTimePriceSpike(input.event, input.thresholds);

    if (!evaluation.shouldSend) {
      response.json({
        ok: true,
        sent: false,
        accepted: evaluation.accepted,
        deduped: evaluation.deduped,
        signal: evaluation.signal,
        score: evaluation.score,
        reasons: evaluation.reasons,
        event: evaluation.event
      });
      return;
    }

    const message = buildPriceSpikeDiscordMessage({
      mention: input.discord?.mention,
      evaluation
    });

    await sendDiscordMessages({
      messages: [message],
      webhookUrl: input.discord?.webhookUrl,
      username: input.discord?.username ?? "Real-time Stock Alert"
    });

    response.json({
      ok: true,
      sent: true,
      accepted: evaluation.accepted,
      deduped: false,
      signal: evaluation.signal,
      score: evaluation.score,
      reasons: evaluation.reasons,
      event: evaluation.event
    });
  } catch (error) {
    next(error);
  }
});

alertRoutes.get("/smart-money-watchlist", async (_request, response, next) => {
  try {
    const items = await listSmartMoneyWatchItems();
    response.json({
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
});

alertRoutes.post("/smart-money-watchlist", async (request, response, next) => {
  try {
    const input = smartMoneyWatchBatchSchema.parse(request.body);
    const items = await upsertSmartMoneyWatchItems(input.items);
    response.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
});

alertRoutes.delete("/smart-money-watchlist/:symbol", async (request, response, next) => {
  try {
    const items = await removeSmartMoneyWatchItem(request.params.symbol);
    response.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
});

alertRoutes.post("/smart-money-watchlist/scan", async (request, response, next) => {
  try {
    const input = smartMoneyScanSchema.parse(request.body);
    const watchItems = (await listSmartMoneyWatchItems()).filter((item) => item.enabled);
    const filters = {
      lookbackTradingDays: input.filters?.lookbackTradingDays ?? 35,
      breakoutLookbackDays: input.filters?.breakoutLookbackDays ?? 20,
      minLeadInPriceChangePercent: input.filters?.minLeadInPriceChangePercent ?? 4,
      minLeadInVolumeRatio: input.filters?.minLeadInVolumeRatio ?? 2.5,
      minBreakoutPriceChangePercent: input.filters?.minBreakoutPriceChangePercent ?? 8,
      minBreakoutVolumeRatio: input.filters?.minBreakoutVolumeRatio ?? 3.5,
      minPullbackSessions: input.filters?.minPullbackSessions ?? 1,
      maxPullbackSessions: input.filters?.maxPullbackSessions ?? 30,
      maxPullbackDrawdownPercent: input.filters?.maxPullbackDrawdownPercent ?? 6.5,
      maxPullbackAvgVolumeRatio: input.filters?.maxPullbackAvgVolumeRatio ?? 0.65,
      minPatternScore: input.filters?.minPatternScore ?? 60,
      minSetupPatternScore: input.filters?.minSetupPatternScore ?? input.filters?.minPatternScore ?? 55,
      minBreakoutPatternScore: input.filters?.minBreakoutPatternScore ?? input.filters?.minPatternScore ?? 68,
      closeNearHighRatio: input.filters?.closeNearHighRatio ?? 0.985,
      recentSignalSessions: input.filters?.recentSignalSessions ?? 2
    };

    const analyses = await analyzeSmartMoneyPatterns(
      watchItems.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        note: item.note,
        referenceDate: input.referenceDate
      })),
      filters
    );
    await updateSmartMoneyWatchScanResults(analyses);

    const matchedAnalyses = analyses.filter((item) => item.pattern.matched);
    const actionableAnalyses = analyses.filter((item) => item.pattern.actionable);
    let messageCount = 0;

    if (input.discord) {
      const targetAnalyses = input.discord.onlyActionable ? actionableAnalyses : matchedAnalyses;
      const messages = buildSmartMoneyPatternDiscordMessages({
        analyses: targetAnalyses,
        filters,
        mention: input.discord.mention
      });

      await sendDiscordMessages({
        messages,
        webhookUrl: input.discord.webhookUrl,
        username: input.discord.username ?? "Smart Money Watchlist Bot"
      });

      messageCount = messages.length;
    }

    response.json({
      ok: true,
      watchCount: watchItems.length,
      matchedCount: matchedAnalyses.length,
      actionableCount: actionableAnalyses.length,
      discordSent: Boolean(input.discord),
      messageCount,
      filters,
      analyses
    });
  } catch (error) {
    next(error);
  }
});
