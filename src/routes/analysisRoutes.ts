import { Router } from "express";
import { z } from "zod";
import { createLogger, toErrorContext } from "../lib/logger.js";
import {
  buildKoreanMoversDiscordMessages,
  buildRecommendationPatternDiscordMessages,
  buildSmartMoneyPatternDiscordMessages,
  sendDiscordMessages
} from "../services/discord.js";
import { fetchBandPost } from "../services/bandClient.js";
import { analyzeKoreanMovers } from "../services/koreanMovers.js";
import { getMarketWatchSnapshots } from "../services/marketWatch.js";
import { readServerSwingPicks, writeServerSwingPicks } from "../services/serverSwingPicks.js";
import { getStockUniverse } from "../services/stockUniverse.js";
import {
  analyzeRecommendationPatterns,
  analyzeRecommendations,
  analyzeSmartMoneyPatterns,
  analyzeSymbols
} from "../services/stockAnalysis.js";
import { resolveSmartMoneyPatternFilters } from "../services/smartMoneyEngine.js";
import { extractStockSymbols } from "../services/symbolExtractor.js";

export const analysisRoutes = Router();
const logger = createLogger("analysisRoutes");

const analysisSchema = z
  .object({
    accessToken: z.string().min(1).optional(),
    bandKey: z.string().min(1).optional(),
    postKey: z.string().min(1).optional(),
    postText: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.postText || (value.accessToken && value.bandKey && value.postKey)), {
    message: "Provide postText or accessToken + bandKey + postKey"
  });

const recommendationSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional()
});

const recommendationBatchSchema = z.object({
  items: z.array(recommendationSchema).min(1)
});

const smartMoneyItemSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional()
});

const marketContextSchema = z.object({
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
});

const recommendationPatternSchema = z.object({
  items: z.array(recommendationSchema).min(1),
  filters: z
    .object({
      lookbackTradingDays: z.coerce.number().int().min(3).max(30).optional(),
      minPriceChangePercent: z.coerce.number().min(0).max(100).optional(),
      minVolumeRatio: z.coerce.number().min(0).max(100).optional(),
      minSignalScore: z.coerce.number().int().min(0).max(100).optional(),
      breakoutWindowDays: z.coerce.number().int().min(5).max(60).optional(),
      requireBreakout: z.coerce.boolean().optional(),
      closeNearHighRatio: z.coerce.number().min(0.9).max(1).optional()
    })
    .optional(),
  discord: z
    .object({
      webhookUrl: z.string().url().optional(),
      username: z.string().min(1).max(80).optional(),
      mention: z.string().min(1).max(200).optional(),
      onlyMatched: z.coerce.boolean().optional().default(true)
    })
    .optional()
});

const smartMoneyPatternSchema = z.object({
  items: z.array(smartMoneyItemSchema).min(1),
  marketContext: marketContextSchema.optional(),
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
      onlyMatched: z.coerce.boolean().optional().default(true),
      onlyActionable: z.coerce.boolean().optional().default(false)
    })
    .optional()
});

const moversQuerySchema = z.object({
  direction: z.enum(["rise", "fall"]).optional().default("rise"),
  market: z.enum(["all", "KOSPI", "KOSDAQ"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  minChangePercent: z.coerce.number().min(0).max(30).optional().default(5),
  minVolumeRatio: z.coerce.number().min(0).max(100).optional().default(2),
  minAlertScore: z.coerce.number().int().min(0).max(100).optional().default(40)
});

const stockUniverseQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional().default(false)
});

const serverSwingPickSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional(),
  category: z.literal("swing")
});

const serverSwingPickBatchSchema = z.object({
  items: z.array(serverSwingPickSchema)
});

const moversDiscordSchema = z.object({
  direction: z.enum(["rise", "fall"]).optional().default("rise"),
  market: z.enum(["all", "KOSPI", "KOSDAQ"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  minChangePercent: z.coerce.number().min(0).max(30).optional().default(7),
  minVolumeRatio: z.coerce.number().min(0).max(100).optional().default(3),
  minAlertScore: z.coerce.number().int().min(0).max(100).optional().default(50),
  webhookUrl: z.string().url().optional(),
  username: z.string().min(1).max(80).optional(),
  mention: z.string().min(1).max(200).optional()
});

analysisRoutes.post("/from-post", async (request, response, next) => {
  try {
    logger.info("from-post:start");
    const input = analysisSchema.parse(request.body);
    const post =
      input.postText != null
        ? {
            postKey: input.postKey,
            content: input.postText
          }
        : await fetchBandPost({
            accessToken: input.accessToken!,
            bandKey: input.bandKey!,
            postKey: input.postKey!
          });

    const symbols = extractStockSymbols(post.content);
    if (!symbols.length) {
      response.status(422).json({
        error: "No stock symbols found in the post",
        post
      });
      return;
    }

    const analyses = await analyzeSymbols(symbols);
    logger.info("from-post:success", {
      symbolCount: symbols.length,
      analysisCount: analyses.length
    });
    response.json({
      post,
      symbols,
      analyses
    });
  } catch (error) {
    logger.error("from-post:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/recommendations", async (request, response, next) => {
  try {
    const input = recommendationBatchSchema.parse(request.body);
    const analyses = await analyzeRecommendations(input.items);
    logger.info("recommendations:success", {
      count: analyses.length
    });
    response.json({
      count: analyses.length,
      analyses
    });
  } catch (error) {
    logger.error("recommendations:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/recommendation-patterns", async (request, response, next) => {
  try {
    const input = recommendationPatternSchema.parse(request.body);
    const filters = {
      lookbackTradingDays: input.filters?.lookbackTradingDays ?? 10,
      minPriceChangePercent: input.filters?.minPriceChangePercent ?? 7,
      minVolumeRatio: input.filters?.minVolumeRatio ?? 3,
      minSignalScore: input.filters?.minSignalScore ?? 50,
      breakoutWindowDays: input.filters?.breakoutWindowDays ?? 20,
      requireBreakout: input.filters?.requireBreakout ?? false,
      closeNearHighRatio: input.filters?.closeNearHighRatio ?? 0.985
    };

    const analyses = await analyzeRecommendationPatterns(input.items, filters);
    const matchedAnalyses = analyses.filter((item) => item.pattern.matched);
    let messageCount = 0;

    if (input.discord) {
      const targetAnalyses = input.discord.onlyMatched === false ? analyses : matchedAnalyses;
      const messages = buildRecommendationPatternDiscordMessages({
        analyses: targetAnalyses,
        filters,
        mention: input.discord.mention
      });

      await sendDiscordMessages({
        messages,
        webhookUrl: input.discord.webhookUrl,
        username: input.discord.username ?? "Recommendation Pattern Bot"
      });

      messageCount = messages.length;
    }

    response.json({
      count: analyses.length,
      matchedCount: matchedAnalyses.length,
      filters,
      discordSent: Boolean(input.discord),
      messageCount,
      analyses
    });
  } catch (error) {
    logger.error("recommendation-patterns:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/smart-money-patterns", async (request, response, next) => {
  try {
    const input = smartMoneyPatternSchema.parse(request.body);
    const filters = resolveSmartMoneyPatternFilters(input.filters);
    const analyses = await analyzeSmartMoneyPatterns(
      input.items.map((item) => ({
        ...item,
        marketContext: input.marketContext,
        debug: input.debug
      })),
      filters
    );
    const matchedAnalyses = analyses.filter((item) => item.pattern.matched);
    const actionableAnalyses = analyses.filter((item) => item.pattern.actionable);
    let messageCount = 0;

    if (input.discord) {
      const targetAnalyses = input.discord.onlyActionable
        ? actionableAnalyses
        : input.discord.onlyMatched === false
          ? analyses
          : matchedAnalyses;
      const messages = buildSmartMoneyPatternDiscordMessages({
        analyses: targetAnalyses,
        filters,
        mention: input.discord.mention
      });

      await sendDiscordMessages({
        messages,
        webhookUrl: input.discord.webhookUrl,
        username: input.discord.username ?? "Smart Money Pattern Bot"
      });

      messageCount = messages.length;
    }

    response.json({
      count: analyses.length,
      matchedCount: matchedAnalyses.length,
      actionableCount: actionableAnalyses.length,
      filters,
      discordSent: Boolean(input.discord),
      messageCount,
      analyses
    });
  } catch (error) {
    logger.error("smart-money-patterns:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/korean-movers", async (request, response, next) => {
  try {
    const input = moversQuerySchema.parse(request.query);
    const analyses = await analyzeKoreanMovers(input);
    logger.info("korean-movers:success", {
      direction: input.direction,
      market: input.market,
      count: analyses.length
    });
    response.json({
      count: analyses.length,
      filters: input,
      analyses
    });
  } catch (error) {
    logger.error("korean-movers:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/stock-universe", async (request, response, next) => {
  try {
    const input = stockUniverseQuerySchema.parse(request.query);
    const payload = await getStockUniverse({
      forceRefresh: input.forceRefresh
    });
    logger.info("stock-universe:success", {
      count: payload.count,
      forceRefresh: input.forceRefresh
    });
    response.json(payload);
  } catch (error) {
    logger.error("stock-universe:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/server-swing-picks", async (_request, response, next) => {
  try {
    const items = await readServerSwingPicks();
    logger.info("server-swing-picks:get:success", {
      count: items.length
    });
    response.json({
      count: items.length,
      items
    });
  } catch (error) {
    logger.error("server-swing-picks:get:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/server-swing-picks", async (request, response, next) => {
  try {
    const input = serverSwingPickBatchSchema.parse(request.body);
    const items = await writeServerSwingPicks(input.items);
    logger.info("server-swing-picks:save:success", {
      count: items.length
    });
    response.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    logger.error("server-swing-picks:save:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/market-watch", async (request, response, next) => {
  try {
    const payload = await getMarketWatchSnapshots();
    logger.info("market-watch:success", {
      count: payload.count,
      fetchedAt: payload.fetchedAt
    });
    response.json(payload);
  } catch (error) {
    logger.error("market-watch:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/korean-movers/discord", async (request, response, next) => {
  try {
    const input = moversDiscordSchema.parse(request.body);
    const filters = {
      direction: input.direction,
      market: input.market,
      limit: input.limit,
      minChangePercent: input.minChangePercent,
      minVolumeRatio: input.minVolumeRatio,
      minAlertScore: input.minAlertScore
    };

    const analyses = await analyzeKoreanMovers(filters);
    const messages = buildKoreanMoversDiscordMessages({
      analyses,
      filters,
      mention: input.mention
    });

    await sendDiscordMessages({
      messages,
      webhookUrl: input.webhookUrl,
      username: input.username
    });

    response.json({
      ok: true,
      count: analyses.length,
      messageCount: messages.length,
      filters,
      analyses
    });
  } catch (error) {
    logger.error("korean-movers-discord:failed", toErrorContext(error));
    next(error);
  }
});
