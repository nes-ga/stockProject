import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import {
  buildKoreanMoversDiscordMessages,
  buildRecommendationUniverseDiscordMessages,
  buildRecommendationPatternDiscordMessages,
  buildSmartMoneyPatternDiscordMessages,
  sendDiscordMessages
} from "../services/discord.js";
import {
  appendDiscordAlertHistoryRecords,
  type DiscordAlertHistoryRecordInput
} from "../services/discordAlertHistory.js";
import { analyzeKoreanMovers } from "../services/koreanMovers.js";
import { getMarketEventCalendarPayload, searchMarketEventCalendar } from "../services/marketEventCalendar.js";
import { getMarketWatchSnapshots } from "../services/marketWatch.js";
import { getRealtimeStockDetail, getRealtimeStockSnapshots } from "../services/realtimeStocks.js";
import { classifySwingCandidate, scanRecommendationUniverse } from "../services/recommendationUniverse.js";
import {
  diffAndRememberDividendUniverseAlerts,
  diffAndRememberLongTermUniverseAlerts,
  diffAndRememberSwingUniverseAlerts,
  type RecommendationUniverseAlertDiff
} from "../services/recommendationUniverseAlerts.js";
import { getDividendEtfRecommendations } from "../services/dividendEtfService.js";
import { readServerDividendPicks, writeServerDividendPicks } from "../services/serverDividendPicks.js";
import { readServerLongTermPicks, writeServerLongTermPicks } from "../services/serverLongTermPicks.js";
import { readServerSwingPickPayload, writeServerSwingPicks } from "../services/serverSwingPicks.js";
import { getStockUniverse } from "../services/stockUniverse.js";
import {
  analyzeRecommendationPatterns,
  analyzeRecommendations,
  analyzeSmartMoneyPatterns
} from "../services/stockAnalysis.js";
import { getNewsSignalDashboard } from "../services/newsSignals.js";
import { getOnlinePresenceSnapshot, heartbeatOnlineViewer } from "../services/onlinePresence.js";
import { readSwingRecommendationHistory, updateSwingRecommendationHistoryFromCurrentPicks } from "../services/recommendationHistory.js";
import { resolveSmartMoneyPatternFilters } from "../services/smartMoneyEngine.js";
import { getSwingProfileFilterOverrides, resolveSwingEngineProfile } from "../services/swingProfiles.js";

export const analysisRoutes = Router();
const logger = createLogger("analysisRoutes");

const recommendationSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional(),
  category: z.enum(["longTerm", "dividend", "swing"]).optional()
});

const recommendationBatchSchema = z.object({
  items: z.array(recommendationSchema).min(1)
});

const realtimeStockSchema = z.object({
  key: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.enum(["longTerm", "dividend", "swing"]).optional()
});

const realtimeStockBatchSchema = z.object({
  items: z.array(realtimeStockSchema).min(1).max(100)
});

const onlinePresenceHeartbeatSchema = z.object({
  viewerId: z.string().min(8).max(128),
  page: z.string().min(1).max(120).optional()
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
  profile: z.enum(["default", "smallcap"]).optional().default("default"),
  marketContext: marketContextSchema.optional(),
  debug: z.coerce.boolean().optional().default(false),
  filters: z
    .object({
      lookbackTradingDays: z.coerce.number().int().min(5).max(60).optional(),
      lookbackWindows: z.array(z.coerce.number().int().min(5).max(60)).min(1).max(8).optional(),
      breakoutLookbackDays: z.coerce.number().int().min(5).max(60).optional(),
      minLeadInPriceChangePercent: z.coerce.number().min(0).max(30).optional(),
      minLeadInVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minLeadInVolumeShares: z.coerce.number().int().min(0).optional(),
      minTurnoverValue: z.coerce.number().min(0).optional(),
      minBreakoutTurnoverValue: z.coerce.number().min(0).optional(),
      minBreakoutPriceChangePercent: z.coerce.number().min(0).max(40).optional(),
      minBreakoutVolumeRatio: z.coerce.number().min(0).max(20).optional(),
      minBreakoutVolumeShares: z.coerce.number().int().min(0).optional(),
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
      pullbackBuySecondEntryRiskRatio: z.coerce.number().min(0.1).max(0.9).optional(),
      pullbackBuyThirdEntryRiskRatio: z.coerce.number().min(0.02).max(0.7).optional(),
      stopLossLookbackSessions: z.coerce.number().int().min(20).max(90).optional(),
      tightPullbackBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      tightPullbackBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      timeCorrectionBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      timeCorrectionBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      volatileDigestionBuyZoneLowRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      volatileDigestionBuyZoneHighRetracementRatio: z.coerce.number().min(0).max(1).optional(),
      minActionableValidityScore: z.coerce.number().int().min(0).max(100).optional(),
      minExecutionReadinessScore: z.coerce.number().int().min(0).max(100).optional(),
      setupValidityMin: z.coerce.number().int().min(0).max(100).optional(),
      setupExecutionMin: z.coerce.number().int().min(0).max(100).optional(),
      breakoutValidityMin: z.coerce.number().int().min(0).max(100).optional(),
      breakoutExecutionMin: z.coerce.number().int().min(0).max(100).optional(),
      executionReadyRiskRewardMin: z.coerce.number().min(0).max(10).optional(),
      executionProbeRiskRewardMin: z.coerce.number().min(0).max(10).optional(),
      bullBreakoutThresholdRelief: z.coerce.number().int().min(0).max(20).optional(),
      bearSetupThresholdTightening: z.coerce.number().int().min(0).max(20).optional(),
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

const swingProfileQuerySchema = z.object({
  profile: z.enum(["default", "smallcap"]).optional().default("default")
});

const recommendationUniverseScanSchema = z.object({
  category: z.enum(["longTerm", "dividend", "swing"]),
  swingProfile: z.enum(["default", "smallcap"]).optional().default("default"),
  discord: z
    .object({
      enabled: z.coerce.boolean().optional().default(true),
      webhookUrl: z.string().url().optional(),
      username: z.string().min(1).max(80).optional(),
      mention: z.string().min(1).max(200).optional()
    })
    .optional()
});
const recommendationUniverseScanStatusSchema = z.object({
  category: z.enum(["longTerm", "dividend", "swing"]),
  swingProfile: z.enum(["default", "smallcap"]).optional().default("default")
});
type RecommendationUniverseScanInput = z.infer<typeof recommendationUniverseScanSchema>;
type RecommendationUniverseScanResponse = Awaited<ReturnType<typeof executeRecommendationUniverseScan>>;
type RecommendationUniverseScanJob = {
  scopeKey: string;
  category: RecommendationUniverseScanInput["category"];
  swingProfile: ReturnType<typeof resolveSwingEngineProfile>;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  promise: Promise<RecommendationUniverseScanResponse>;
  result?: RecommendationUniverseScanResponse;
  errorMessage?: string;
};
const recommendationUniverseScanJobs = new Map<string, RecommendationUniverseScanJob>();
const recommendationUniverseScanJobTtlMs = 30 * 60 * 1000;

const serverSwingPickSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional(),
  bucket: z.enum(["execution", "execution_ready", "execution_probe", "watch"]).optional(),
  tags: z.array(z.string().min(1)).optional(),
  reasons: z.array(z.string().min(1)).optional(),
  penaltyFactors: z
    .array(
      z.object({
        code: z.string().min(1),
        label: z.string().min(1),
        impact: z.coerce.number(),
        reason: z.string().min(1)
      })
    )
    .optional(),
  envelope: z
    .object({
      basisPeriod: z.literal(20),
      bandPercent: z.literal(10),
      basis: z.coerce.number(),
      upper: z.coerce.number(),
      lower: z.coerce.number(),
      position: z.enum(["above_upper", "upper_band", "basis_zone", "lower_band", "below_lower"]),
      distanceFromBasisPercent: z.coerce.number(),
      distanceFromLowerPercent: z.coerce.number(),
      distanceFromUpperPercent: z.coerce.number(),
      lowerBreakSessions: z.coerce.number().int().min(0),
      lowerReclaimed: z.boolean(),
      inBand: z.boolean()
    })
    .optional(),
  haltCategory: z.string().min(1).optional(),
  haltAction: z.string().min(1).optional(),
  category: z.literal("swing"),
  swingProfile: z.enum(["default", "smallcap"]).optional(),
  source: z.string().min(1).max(100).optional()
});

const serverSwingPickBatchSchema = z.object({
  items: z.array(serverSwingPickSchema).optional(),
  executionItems: z.array(serverSwingPickSchema).optional(),
  watchItems: z.array(serverSwingPickSchema).optional()
}).refine((value) => Array.isArray(value.items) || Array.isArray(value.executionItems) || Array.isArray(value.watchItems), {
  message: "At least one swing pick list is required."
});

const serverLongTermPickSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional(),
  category: z.literal("longTerm"),
  longTermBucket: z.enum(["buy", "watch"]).optional(),
  source: z.string().min(1).max(100).optional()
});

const serverLongTermPickBatchSchema = z.object({
  items: z.array(serverLongTermPickSchema)
});

const serverDividendPickSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  latestDividendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  latestDividendAmount: z.coerce.number().min(0).optional(),
  note: z.string().min(1).optional(),
  category: z.literal("dividend"),
  longTermBucket: z.enum(["buy", "watch"]).optional(),
  source: z.string().min(1).max(100).optional()
});

const serverDividendPickBatchSchema = z.object({
  items: z.array(serverDividendPickSchema)
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


type RecommendationPatternHistoryAnalysis = Awaited<ReturnType<typeof analyzeRecommendationPatterns>>[number];
type SmartMoneyPatternHistoryAnalysis = Awaited<ReturnType<typeof analyzeSmartMoneyPatterns>>[number];
type KoreanMoverHistoryAnalysis = Awaited<ReturnType<typeof analyzeKoreanMovers>>[number];

type UniverseAlertHistoryItem = {
  symbol?: string;
  name?: string;
  key?: string;
  bucket?: string;
  longTermBucket?: string;
  anchorDate?: string;
  latestMentionDate?: string;
  note?: string;
  reasons?: string[];
  tags?: string[];
  penaltyFactors?: unknown;
  postEntryOutcome?: unknown;
  envelope?: unknown;
  category?: string;
  swingProfile?: string;
  source?: string;
};

function parseBuyPlanFromNote(note: string | undefined) {
  if (!note) {
    return undefined;
  }

  const buyMatch = note.match(/매수\s+([\d,]+)\/([\d,]+)\/([\d,]+)/);
  const stopMatch = note.match(/손절\s+([\d,]+)/);
  const parsePrice = (value: string | undefined) => {
    const parsed = Number(value?.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  if (!buyMatch && !stopMatch) {
    return undefined;
  }

  return {
    firstBuyPrice: parsePrice(buyMatch?.[1]),
    secondBuyPrice: parsePrice(buyMatch?.[2]),
    thirdBuyPrice: parsePrice(buyMatch?.[3]),
    stopLossPrice: parsePrice(stopMatch?.[1])
  };
}

function getUniverseHistoryCategory(diff: RecommendationUniverseAlertDiff) {
  if (diff.category === "smallcapSwing") {
    return "swing";
  }
  return diff.category;
}

function getUniverseHistoryProfile(diff: RecommendationUniverseAlertDiff) {
  if (diff.category === "smallcapSwing") {
    return "smallcap";
  }
  if (diff.category === "swing") {
    return "default";
  }
  return undefined;
}

function collectUniverseAlertItems(payload: {
  executionItems?: UniverseAlertHistoryItem[];
  watchItems?: UniverseAlertHistoryItem[];
  items?: UniverseAlertHistoryItem[];
}) {
  const executionItems = (payload.executionItems ?? []).map((item) => ({
    ...item,
    bucket: item.bucket ?? "execution"
  }));
  const watchItems = (payload.watchItems ?? []).map((item) => ({
    ...item,
    bucket: item.bucket ?? "watch"
  }));
  const items = (payload.items ?? []).map((item) => ({
    ...item,
    bucket: item.bucket ?? item.longTermBucket
  }));

  return [...executionItems, ...watchItems, ...items];
}

function buildRecommendationUniverseAlertHistoryRecords(params: {
  diff: RecommendationUniverseAlertDiff;
  payload: {
    executionItems?: UniverseAlertHistoryItem[];
    watchItems?: UniverseAlertHistoryItem[];
    items?: UniverseAlertHistoryItem[];
  };
  username?: string;
  messageCount: number;
}): DiscordAlertHistoryRecordInput[] {
  const currentBySymbol = new Map(
    collectUniverseAlertItems(params.payload)
      .filter((item) => item.symbol)
      .map((item) => [String(item.symbol), item])
  );
  const category = getUniverseHistoryCategory(params.diff);
  const profile = getUniverseHistoryProfile(params.diff);

  return params.diff.changes.map((change, index) => {
    const currentItem = currentBySymbol.get(change.symbol);
    return {
      alertType: "recommendation-universe",
      source: "recommendation-universe-scan",
      username: params.username,
      messageCount: params.messageCount,
      messageIndex: index + 1,
      category,
      profile,
      symbol: change.symbol,
      name: change.name,
      bucket: change.toBucket,
      previousBucket: change.fromBucket,
      changeType: change.type,
      anchorDate: currentItem?.anchorDate,
      latestMentionDate: currentItem?.latestMentionDate,
      metadata: {
        rawCategory: params.diff.category,
        key: currentItem?.key,
        note: currentItem?.note,
        buyPlan: parseBuyPlanFromNote(currentItem?.note),
        reasons: currentItem?.reasons,
        tags: currentItem?.tags,
        penaltyFactors: currentItem?.penaltyFactors,
        envelope: currentItem?.envelope,
        postEntryOutcome: currentItem?.postEntryOutcome,
        source: currentItem?.source,
        currentCount: params.diff.currentCount,
        previousCount: params.diff.previousCount
      }
    };
  });
}

function buildRecommendationPatternAlertHistoryRecords(params: {
  analyses: RecommendationPatternHistoryAnalysis[];
  username?: string;
  messageCount: number;
}): DiscordAlertHistoryRecordInput[] {
  if (!params.analyses.length) {
    return [
      {
        alertType: "recommendation-pattern",
        source: "recommendation-patterns",
        username: params.username,
        messageCount: params.messageCount,
        messageIndex: 1,
        category: "recommendation-pattern",
        metadata: {
          result: "no-matches"
        }
      }
    ];
  }

  return params.analyses.map((item, index) => ({
    alertType: "recommendation-pattern",
    source: "recommendation-patterns",
    username: params.username,
    messageCount: params.messageCount,
    messageIndex: index + 1,
    category: "recommendation-pattern",
    symbol: item.symbol,
    name: item.name,
    anchorDate: item.tradingAnchorDate,
    metadata: {
      matched: item.pattern.matched,
      signalDate: item.pattern.signalDate,
      signalScore: item.pattern.signalScore,
      priceChangePercent: item.pattern.priceChangePercent,
      volumeRatio20d: item.pattern.volumeRatio20d,
      reasons: item.pattern.reasons
    }
  }));
}

function buildSmartMoneyAlertHistoryRecords(params: {
  alertType: "smart-money-pattern" | "smart-money-watchlist";
  source: string;
  analyses: SmartMoneyPatternHistoryAnalysis[];
  username?: string;
  messageCount: number;
  profile?: string;
}): DiscordAlertHistoryRecordInput[] {
  if (!params.analyses.length) {
    return [
      {
        alertType: params.alertType,
        source: params.source,
        username: params.username,
        messageCount: params.messageCount,
        messageIndex: 1,
        category: "swing",
        profile: params.profile,
        metadata: {
          result: "no-matches"
        }
      }
    ];
  }

  return params.analyses.map((item, index) => {
    const classification = classifySwingCandidate(item);
    return {
      alertType: params.alertType,
      source: params.source,
      username: params.username,
      messageCount: params.messageCount,
      messageIndex: index + 1,
      category: "swing",
      profile: params.profile,
      symbol: item.symbol,
      name: item.name,
      bucket: classification.bucket,
      anchorDate: item.tradingReferenceDate,
      referenceDate: item.tradingReferenceDate,
      metadata: {
        matched: item.pattern.matched,
        actionable: classification.bucket !== "watch",
        status: item.pattern.status,
        entryStrategy: item.pattern.entryStrategy,
        patternScore: item.pattern.patternScore,
        finalRankScore: item.pattern.finalRankScore,
        leadInDate: item.pattern.leadInDate,
        breakoutDate: item.pattern.breakoutDate,
        buyPlan: item.pattern.buyPlan,
        invalidationPrice: item.pattern.invalidationPrice,
        reasons: item.pattern.reasons,
        tags: item.pattern.tags,
        penaltyFactors: item.pattern.penaltyFactors
      }
    };
  });
}

function buildKoreanMoverAlertHistoryRecords(params: {
  analyses: KoreanMoverHistoryAnalysis[];
  username?: string;
  messageCount: number;
}): DiscordAlertHistoryRecordInput[] {
  if (!params.analyses.length) {
    return [
      {
        alertType: "korean-movers",
        source: "korean-movers-discord",
        username: params.username,
        messageCount: params.messageCount,
        messageIndex: 1,
        category: "korean-movers",
        metadata: {
          result: "no-matches"
        }
      }
    ];
  }

  return params.analyses.map((item, index) => ({
    alertType: "korean-movers",
    source: "korean-movers-discord",
    username: params.username,
    messageCount: params.messageCount,
    messageIndex: index + 1,
    category: "korean-movers",
    symbol: item.symbol,
    name: item.name,
    metadata: {
      market: item.market,
      direction: item.direction,
      signal: item.signal,
      alertScore: item.alertScore,
      changePercent: item.changePercent,
      volumeRatio20d: item.volumeRatio20d,
      estimatedTurnover: item.estimatedTurnover,
      reasons: item.reasons
    }
  }));
}

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

      const username = input.discord.username ?? "Recommendation Pattern Bot";
      await sendDiscordMessages({
        messages,
        webhookUrl: input.discord.webhookUrl,
        username
      });
      await appendDiscordAlertHistoryRecords(
        buildRecommendationPatternAlertHistoryRecords({
          analyses: targetAnalyses,
          username,
          messageCount: messages.length
        })
      );

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
    const profile = resolveSwingEngineProfile(input.profile);
    const filters = resolveSmartMoneyPatternFilters({
      ...getSwingProfileFilterOverrides(profile),
      ...input.filters
    });
    const analyses = await analyzeSmartMoneyPatterns(
      input.items.map((item) => ({
        ...item,
        marketContext: input.marketContext,
        debug: input.debug
      })),
      filters
    );
    const matchedAnalyses = analyses.filter((item) => item.pattern.matched);
    const actionableAnalyses = analyses.filter((item) => classifySwingCandidate(item).bucket !== "watch");
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

      const username = input.discord.username ?? "Smart Money Pattern Bot";
      await sendDiscordMessages({
        messages,
        webhookUrl: input.discord.webhookUrl,
        username
      });
      await appendDiscordAlertHistoryRecords(
        buildSmartMoneyAlertHistoryRecords({
          alertType: "smart-money-pattern",
          source: "smart-money-patterns",
          analyses: targetAnalyses,
          username,
          messageCount: messages.length,
          profile
        })
      );

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

function getRecommendationUniverseScanScopeKey(
  category: RecommendationUniverseScanInput["category"],
  swingProfile: ReturnType<typeof resolveSwingEngineProfile>
) {
  return category === "swing" && swingProfile === "smallcap" ? "swing:smallcap" : category;
}

function pruneRecommendationUniverseScanJobs() {
  const now = Date.now();
  for (const [scopeKey, job] of recommendationUniverseScanJobs) {
    if (job.status === "running" || !job.finishedAt) {
      continue;
    }

    if (now - Date.parse(job.finishedAt) > recommendationUniverseScanJobTtlMs) {
      recommendationUniverseScanJobs.delete(scopeKey);
    }
  }
}

function serializeRecommendationUniverseScanJob(job: RecommendationUniverseScanJob) {
  return {
    scopeKey: job.scopeKey,
    category: job.category,
    swingProfile: job.swingProfile,
    status: job.status,
    running: job.status === "running",
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.errorMessage,
    result: job.status === "completed" ? job.result : undefined
  };
}

async function executeRecommendationUniverseScan(input: RecommendationUniverseScanInput) {
  const swingProfile = resolveSwingEngineProfile(input.swingProfile);
  const payload = await scanRecommendationUniverse(input.category, {
    swingProfile
  });
  const universeDiff =
    payload.category === "swing"
      ? await diffAndRememberSwingUniverseAlerts({
          profile: swingProfile,
          executionItems: payload.executionItems,
          watchItems: payload.watchItems
        })
      : payload.category === "dividend"
        ? await diffAndRememberDividendUniverseAlerts(payload.items)
        : await diffAndRememberLongTermUniverseAlerts(payload.items);
  const discordEnabled = input.discord?.enabled !== false;
  const webhookUrl = input.discord?.webhookUrl ?? config.discordWebhookUrl;
  let discordSent = false;
  let discordMessageCount = 0;
  let discordSkippedReason: string | undefined;

  if (discordEnabled && webhookUrl) {
    const messages = buildRecommendationUniverseDiscordMessages({
      diff: universeDiff,
      mention: input.discord?.mention
    });

    if (messages.length) {
      const username = input.discord?.username ?? "Recommendation Universe Bot";
      await sendDiscordMessages({
        messages,
        webhookUrl,
        username
      });
      await appendDiscordAlertHistoryRecords(
        buildRecommendationUniverseAlertHistoryRecords({
          diff: universeDiff,
          payload,
          username,
          messageCount: messages.length
        })
      );
      discordSent = true;
      discordMessageCount = messages.length;
    }
  } else if (discordEnabled) {
    discordSkippedReason = "missing-webhook-url";
    logger.warn("recommendation-universe-scan:discord-skipped", {
      category: input.category,
      swingProfile,
      reason: discordSkippedReason
    });
  }

  logger.info("recommendation-universe-scan:success", {
    category: input.category,
    swingProfile,
    count: payload.count,
    discordSent,
    discordMessageCount,
    discordSkippedReason,
    diffCount: universeDiff.changes.length,
    historyUpdated: payload.category === "swing" ? payload.historyUpdated : undefined,
    historyCaseCount: payload.category === "swing" ? payload.historyUpdate?.caseCount : undefined,
    historyUpdateError: payload.category === "swing" ? payload.historyUpdateError : undefined
  });

  return {
    ok: true,
    ...payload,
    discordSent,
    discordMessageCount,
    discordSkippedReason,
    universeDiff
  };
}

function startRecommendationUniverseScanJob(input: RecommendationUniverseScanInput) {
  pruneRecommendationUniverseScanJobs();
  const swingProfile = resolveSwingEngineProfile(input.swingProfile);
  const scopeKey = getRecommendationUniverseScanScopeKey(input.category, swingProfile);
  const existing = recommendationUniverseScanJobs.get(scopeKey);
  if (existing?.status === "running") {
    return existing;
  }

  const startedAt = new Date().toISOString();
  const job: RecommendationUniverseScanJob = {
    scopeKey,
    category: input.category,
    swingProfile,
    status: "running" as const,
    startedAt,
    promise: Promise.resolve(undefined as unknown as RecommendationUniverseScanResponse)
  };
  const promise = executeRecommendationUniverseScan(input)
    .then((result) => {
      job.status = "completed";
      job.finishedAt = new Date().toISOString();
      job.result = result;
      return result;
    })
    .catch((error: unknown) => {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    });

  job.promise = promise;
  recommendationUniverseScanJobs.set(scopeKey, job);
  return job;
}

analysisRoutes.get("/recommendation-universe-scan/status", (request, response) => {
  pruneRecommendationUniverseScanJobs();
  const input = recommendationUniverseScanStatusSchema.parse(request.query);
  const swingProfile = resolveSwingEngineProfile(input.swingProfile);
  const scopeKey = getRecommendationUniverseScanScopeKey(input.category, swingProfile);
  const job = recommendationUniverseScanJobs.get(scopeKey);

  response.json({
    scopeKey,
    category: input.category,
    swingProfile,
    status: job ? job.status : "idle",
    running: job?.status === "running",
    job: job ? serializeRecommendationUniverseScanJob(job) : undefined
  });
});

analysisRoutes.post("/recommendation-universe-scan", async (request, response, next) => {
  try {
    const input = recommendationUniverseScanSchema.parse(request.body);
    const job = startRecommendationUniverseScanJob(input);
    if (request.query.async === "true") {
      response.status(202).json({
        accepted: true,
        ...serializeRecommendationUniverseScanJob(job)
      });
      return;
    }

    const payload = await job.promise;
    response.json(payload);
  } catch (error) {
    logger.error("recommendation-universe-scan:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/server-swing-picks", async (request, response, next) => {
  try {
    const input = swingProfileQuerySchema.parse(request.query);
    const profile = resolveSwingEngineProfile(input.profile);
    const payload = await readServerSwingPickPayload(profile);
    logger.info("server-swing-picks:get:success", {
      profile,
      count: payload.items.length,
      executionCount: payload.executionItems.length,
      watchCount: payload.watchItems.length
    });
    response.json({
      count: payload.items.length,
      executionCount: payload.executionItems.length,
      watchCount: payload.watchItems.length,
      items: payload.items,
      executionItems: payload.executionItems,
      watchItems: payload.watchItems
    });
  } catch (error) {
    logger.error("server-swing-picks:get:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/server-swing-picks", async (request, response, next) => {
  try {
    const query = swingProfileQuerySchema.parse(request.query);
    const profile = resolveSwingEngineProfile(query.profile);
    const input = serverSwingPickBatchSchema.parse(request.body);
    const payload = await writeServerSwingPicks(input, { profile });
    let historyUpdate: Awaited<ReturnType<typeof updateSwingRecommendationHistoryFromCurrentPicks>> | undefined;
    let historyUpdateError: string | undefined;

    try {
      historyUpdate = await updateSwingRecommendationHistoryFromCurrentPicks();
    } catch (error) {
      historyUpdateError = error instanceof Error ? error.message : String(error);
    }

    logger.info("server-swing-picks:save:success", {
      profile,
      count: payload.items.length,
      executionCount: payload.executionItems.length,
      watchCount: payload.watchItems.length,
      historyUpdated: Boolean(historyUpdate),
      historyUpdateError
    });
    response.json({
      ok: true,
      count: payload.items.length,
      executionCount: payload.executionItems.length,
      watchCount: payload.watchItems.length,
      items: payload.items,
      executionItems: payload.executionItems,
      watchItems: payload.watchItems,
      historyUpdated: Boolean(historyUpdate),
      historyUpdate,
      historyUpdateError
    });
  } catch (error) {
    logger.error("server-swing-picks:save:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/server-long-term-picks", async (_request, response, next) => {
  try {
    const items = await readServerLongTermPicks();
    logger.info("server-long-term-picks:get:success", {
      count: items.length
    });
    response.json({
      count: items.length,
      items
    });
  } catch (error) {
    logger.error("server-long-term-picks:get:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/server-long-term-picks", async (request, response, next) => {
  try {
    const input = serverLongTermPickBatchSchema.parse(request.body);
    const items = await writeServerLongTermPicks(input.items);
    logger.info("server-long-term-picks:save:success", {
      count: items.length
    });
    response.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    logger.error("server-long-term-picks:save:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/server-dividend-picks", async (_request, response, next) => {
  try {
    const stocks = await readServerDividendPicks();
    const etfResult = getDividendEtfRecommendations();
    logger.info("server-dividend-picks:get:success", {
      count: stocks.length,
      etfCount: etfResult.items.length
    });
    response.json({
      count: stocks.length,
      etfCount: etfResult.items.length,
      items: stocks,
      stocks,
      etfs: etfResult.items
    });
  } catch (error) {
    logger.error("server-dividend-picks:get:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/server-dividend-picks", async (request, response, next) => {
  try {
    const input = serverDividendPickBatchSchema.parse(request.body);
    const stocks = await writeServerDividendPicks(input.items);
    const etfResult = getDividendEtfRecommendations();
    logger.info("server-dividend-picks:save:success", {
      count: stocks.length,
      etfCount: etfResult.items.length
    });
    response.json({
      ok: true,
      count: stocks.length,
      etfCount: etfResult.items.length,
      items: stocks,
      stocks,
      etfs: etfResult.items
    });
  } catch (error) {
    logger.error("server-dividend-picks:save:failed", toErrorContext(error));
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

analysisRoutes.post("/realtime-stocks", async (request, response, next) => {
  try {
    const input = realtimeStockBatchSchema.parse(request.body);
    const payload = await getRealtimeStockSnapshots(input.items);
    logger.info("realtime-stocks:success", {
      count: payload.count,
      fetchedAt: payload.fetchedAt
    });
    response.json(payload);
  } catch (error) {
    logger.error("realtime-stocks:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/realtime-stock-detail", async (request, response, next) => {
  try {
    const input = realtimeStockSchema.parse(request.body);
    const payload = await getRealtimeStockDetail(input);
    logger.info("realtime-stock-detail:success", {
      symbol: payload.symbol,
      latestDate: payload.latestDate,
      fetchedAt: payload.fetchedAt
    });
    response.json(payload);
  } catch (error) {
    logger.error("realtime-stock-detail:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/news-signals", (_request, response, next) => {
  try {
    const payload = getNewsSignalDashboard();
    logger.info("news-signals:success", {
      articleCount: payload.articleCount,
      signalCount: payload.signalCount
    });
    response.json(payload);
  } catch (error) {
    logger.error("news-signals:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/recommendation-history/swing", async (_request, response, next) => {
  try {
    const payload = await readSwingRecommendationHistory();
    response.json(payload);
  } catch (error) {
    logger.error("recommendation-history:swing:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/online-presence", (_request, response, next) => {
  try {
    response.json(getOnlinePresenceSnapshot());
  } catch (error) {
    logger.error("online-presence:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/online-presence/heartbeat", (request, response, next) => {
  try {
    const parsed = onlinePresenceHeartbeatSchema.parse(request.body);
    const payload = heartbeatOnlineViewer({
      viewerId: parsed.viewerId,
      page: parsed.page,
      userAgent: request.get("user-agent")
    });
    response.json(payload);
  } catch (error) {
    logger.error("online-presence-heartbeat:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.get("/market-event-calendar", async (_request, response, next) => {
  try {
    const payload = await getMarketEventCalendarPayload();
    logger.info("market-event-calendar:success", {
      eventCount: payload.events.length,
      summaryCount: payload.summaries.length
    });
    response.json(payload);
  } catch (error) {
    logger.error("market-event-calendar:failed", toErrorContext(error));
    next(error);
  }
});

analysisRoutes.post("/market-event-calendar/search", async (_request, response, next) => {
  try {
    const payload = await searchMarketEventCalendar();
    logger.info("market-event-calendar:search:success", {
      eventCount: payload.events.length,
      summaryCount: payload.summaries.length,
      addedCount: payload.addedCount
    });
    response.json(payload);
  } catch (error) {
    logger.error("market-event-calendar:search:failed", toErrorContext(error));
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

    const username = input.username ?? "Stock Alert Bot";
    await sendDiscordMessages({
      messages,
      webhookUrl: input.webhookUrl,
      username
    });
    await appendDiscordAlertHistoryRecords(
      buildKoreanMoverAlertHistoryRecords({
        analyses,
        username,
        messageCount: messages.length
      })
    );

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
