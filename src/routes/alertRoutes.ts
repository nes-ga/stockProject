import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { buildSmartMoneyPatternDiscordMessages, sendDiscordMessages } from "../services/discord.js";
import { evaluateRealTimePriceSpike } from "../services/realtimeAlerts.js";
import { resolveSmartMoneyPatternFilters } from "../services/smartMoneyEngine.js";
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
  marketContext: z
    .object({
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      marketTrend: z.enum(["bullish", "neutral", "bearish"]).optional(),
      marketBreadth: z
        .object({
          score: z.coerce.number().min(0).max(100).optional(),
          advanceDeclineRatio: z.coerce.number().min(0).max(10).optional(),
          advancingPercent: z.coerce.number().min(0).max(100).optional()
        })
        .optional(),
      momentumCondition: z.enum(["strong", "neutral", "weak"]).optional(),
      leaderPersistenceScore: z.coerce.number().min(0).max(100).optional(),
      regimeScore: z.coerce.number().min(0).max(100).optional(),
      marketContextScore: z.coerce.number().min(0).max(100).optional(),
      trendScore: z.coerce.number().min(0).max(100).optional(),
      riskScore: z.coerce.number().min(0).max(100).optional(),
      sectorStrengthScore: z.coerce.number().min(0).max(100).optional(),
      riskOff: z.coerce.boolean().optional(),
      benchmark: z
        .object({
          symbol: z.string().min(1).optional(),
          trend: z.enum(["bullish", "neutral", "bearish"]).optional(),
          changePercent20d: z.coerce.number().min(-100).max(200).optional(),
          aboveSma20: z.coerce.boolean().optional(),
          aboveSma50: z.coerce.boolean().optional()
        })
        .optional(),
      sector: z
        .object({
          name: z.string().min(1).optional(),
          strengthScore: z.coerce.number().min(0).max(100).optional(),
          relativeStrengthPercent: z.coerce.number().min(-100).max(200).optional()
        })
        .optional(),
      notes: z.array(z.string().min(1).max(200)).max(5).optional()
    })
    .optional(),
  debug: z.coerce.boolean().optional().default(false),
  filters: z
    .object({
      lookbackTradingDays: z.coerce.number().int().min(5).max(60).optional(),
      lookbackWindows: z.array(z.coerce.number().int().min(5).max(60)).min(1).max(8).optional(),
      breakoutLookbackDays: z.coerce.number().int().min(5).max(60).optional(),
      minLeadInPriceChangePercent: z.coerce.number().min(0).max(30).optional(),
      minLeadInVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minTurnoverValue: z.coerce.number().min(0).optional(),
      minBreakoutTurnoverValue: z.coerce.number().min(0).optional(),
      minBreakoutPriceChangePercent: z.coerce.number().min(0).max(40).optional(),
      minBreakoutVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minPullbackSessions: z.coerce.number().int().min(1).max(30).optional(),
      maxPullbackSessions: z.coerce.number().int().min(1).max(30).optional(),
      minSetupPullbackSessions: z.coerce.number().int().min(1).max(20).optional(),
      minSetupDownSessions: z.coerce.number().int().min(1).max(20).optional(),
      minTimeCorrectionSessions: z.coerce.number().int().min(1).max(20).optional(),
      minPullbackDrawdownPercent: z.coerce.number().min(0).max(20).optional(),
      maxPullbackDrawdownPercent: z.coerce.number().min(0).max(20).optional(),
      maxPullbackRangePercent: z.coerce.number().min(0).max(30).optional(),
      maxSetupPullbackDrawdownPercent: z.coerce.number().min(0).max(60).optional(),
      maxSetupPullbackRangePercent: z.coerce.number().min(0).max(60).optional(),
      maxTimeCorrectionDrawdownPercent: z.coerce.number().min(0).max(20).optional(),
      maxTimeCorrectionRangePercent: z.coerce.number().min(0).max(20).optional(),
      maxTimeCorrectionCloseRangePercent: z.coerce.number().min(0).max(20).optional(),
      minTimeCorrectionTightClosePercent: z.coerce.number().min(-30).max(10).optional(),
      maxVolatileDigestionDrawdownPercent: z.coerce.number().min(0).max(60).optional(),
      maxVolatileDigestionRangePercent: z.coerce.number().min(0).max(80).optional(),
      maxVolatileDigestionAvgVolumeRatio: z.coerce.number().min(0.01).max(1).optional(),
      minVolatileDigestionReferenceCloseVsLeadInPercent: z.coerce.number().min(-50).max(20).optional(),
      minVolatileDigestionBaseAdvancePercent: z.coerce.number().min(0).max(100).optional(),
      volatileDigestionSetupScoreBoost: z.coerce.number().int().min(0).max(40).optional(),
      maxPullbackAvgVolumeRatio: z.coerce.number().min(0.1).max(1).optional(),
      minPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      minSetupPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      minBreakoutPatternScore: z.coerce.number().int().min(0).max(100).optional(),
      minSetupSurgeAdvancePercent: z.coerce.number().min(0).max(60).optional(),
      minSetupContinuationSessions: z.coerce.number().int().min(1).max(5).optional(),
      minReferenceCloseVsBasePercent: z.coerce.number().min(-30).max(60).optional(),
      maxSetupCloseVsPeakPercent: z.coerce.number().min(-50).max(10).optional(),
      minReferenceCloseVsLeadInPercent: z.coerce.number().min(-30).max(30).optional(),
      closeNearHighRatio: z.coerce.number().min(0.9).max(1).optional(),
      breakoutHoldTolerancePercent: z.coerce.number().min(0).max(10).optional(),
      maxBreakoutFailurePercent: z.coerce.number().min(0).max(15).optional(),
      maxBreakoutExtensionPercent: z.coerce.number().min(0).max(25).optional(),
      maxSetupDistanceBelowBreakoutLevelPercent: z.coerce.number().min(0).max(20).optional(),
      minPullbackBuyDrawdownPercent: z.coerce.number().min(0).max(40).optional(),
      minPullbackBuyDistanceBelowBreakoutPercent: z.coerce.number().min(0).max(40).optional(),
      minTightPullbackBuyLeadInPriceChangePercent: z.coerce.number().min(0).max(40).optional(),
      pullbackBuyStartPercentFromPeak: z.coerce.number().min(0).max(50).optional(),
      firstBuySma20ProximityPercent: z.coerce.number().min(0).max(10).optional(),
      stopLossLookbackSessions: z.coerce.number().int().min(20).max(90).optional(),
      tightPullbackBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      tightPullbackBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      timeCorrectionBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      timeCorrectionBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      volatileDigestionBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      volatileDigestionBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      minActionableValidityScore: z.coerce.number().int().min(0).max(100).optional(),
      minExecutionReadinessScore: z.coerce.number().int().min(0).max(100).optional(),
      regimeScoreWeight: z.coerce.number().min(0).max(1).optional(),
      minRegimeScoreForActionable: z.coerce.number().int().min(0).max(100).optional(),
      blockActionableOnRiskOff: z.coerce.boolean().optional(),
      recentSignalSessions: z.coerce.number().int().min(1).max(10).optional(),
      debugTopCandidateLimit: z.coerce.number().int().min(1).max(10).optional()
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
    const filters = resolveSmartMoneyPatternFilters(input.filters);

    const analyses = await analyzeSmartMoneyPatterns(
      watchItems.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        note: item.note,
        referenceDate: input.referenceDate,
        marketContext: input.marketContext,
        debug: input.debug
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
