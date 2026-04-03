import { Router } from "express";
import { z } from "zod";
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
import { extractStockSymbols } from "../services/symbolExtractor.js";

export const analysisRoutes = Router();

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
    response.json({
      post,
      symbols,
      analyses
    });
  } catch (error) {
    next(error);
  }
});

analysisRoutes.post("/recommendations", async (request, response, next) => {
  try {
    const input = recommendationBatchSchema.parse(request.body);
    const analyses = await analyzeRecommendations(input.items);
    response.json({
      count: analyses.length,
      analyses
    });
  } catch (error) {
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
    next(error);
  }
});

analysisRoutes.post("/smart-money-patterns", async (request, response, next) => {
  try {
    const input = smartMoneyPatternSchema.parse(request.body);
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

    const analyses = await analyzeSmartMoneyPatterns(input.items, filters);
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
    next(error);
  }
});

analysisRoutes.get("/korean-movers", async (request, response, next) => {
  try {
    const input = moversQuerySchema.parse(request.query);
    const analyses = await analyzeKoreanMovers(input);
    response.json({
      count: analyses.length,
      filters: input,
      analyses
    });
  } catch (error) {
    next(error);
  }
});

analysisRoutes.get("/stock-universe", async (request, response, next) => {
  try {
    const input = stockUniverseQuerySchema.parse(request.query);
    const payload = await getStockUniverse({
      forceRefresh: input.forceRefresh
    });
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

analysisRoutes.get("/server-swing-picks", async (_request, response, next) => {
  try {
    const items = await readServerSwingPicks();
    response.json({
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
});

analysisRoutes.post("/server-swing-picks", async (request, response, next) => {
  try {
    const input = serverSwingPickBatchSchema.parse(request.body);
    const items = await writeServerSwingPicks(input.items);
    response.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
});

analysisRoutes.get("/market-watch", async (request, response, next) => {
  try {
    const payload = await getMarketWatchSnapshots();
    response.json(payload);
  } catch (error) {
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
    next(error);
  }
});
