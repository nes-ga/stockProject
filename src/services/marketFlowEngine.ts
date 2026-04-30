import { formatDateTimeInTimeZone, SEOUL_TIME_ZONE } from "../lib/dates.js";
import type { MarketFlowDashboardPayload, MarketFlowMode, MarketWatchSnapshot } from "../types.js";
import { createLogger } from "../lib/logger.js";
import { getMarketWatchSnapshots } from "./marketWatch.js";
import { getGlobalCycleSnapshot, getLocalCycleSnapshot } from "./marketCycleEngine.js";
import { persistMarketFlowPayload } from "./marketFlowHistory.js";
import { getThemeRotationPayload } from "./themeRotationEngine.js";

const logger = createLogger("marketFlowEngine");
const MARKET_FLOW_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedMarketFlow:
  | {
      expiresAt: number;
      payload: MarketFlowDashboardPayload;
    }
  | undefined;

function resolveMarketMode(payload: {
  globalState: MarketFlowDashboardPayload["global"]["state"];
  localState: MarketFlowDashboardPayload["local"]["state"];
}): MarketFlowMode {
  if (payload.globalState === "RISK_ON" && payload.localState === "STRONG") {
    return "AGGRESSIVE";
  }
  if (payload.localState === "SELECTIVE") {
    return "SELECTIVE";
  }
  if (payload.globalState === "RISK_OFF" || payload.localState === "DEFENSIVE") {
    return "DEFENSIVE";
  }
  return "NEUTRAL";
}

function buildInterpretation(payload: {
  marketMode: MarketFlowMode;
  globalState: MarketFlowDashboardPayload["global"]["state"];
  localState: MarketFlowDashboardPayload["local"]["state"];
  topThemes: Array<{ label: string }>;
  bottomThemes: Array<{ label: string }>;
}) {
  const modeLine =
    payload.marketMode === "AGGRESSIVE"
      ? "현재 시장은 공격적 대응 구간입니다."
      : payload.marketMode === "SELECTIVE"
        ? "현재 시장은 선택적 매매 구간입니다."
        : payload.marketMode === "DEFENSIVE"
          ? "현재 시장은 방어적 대응 구간입니다."
          : "현재 시장은 중립 구간입니다.";
  const globalLine =
    payload.globalState === "RISK_ON"
      ? "글로벌 환경은 위험자산 선호 쪽으로 기울어 있습니다."
      : payload.globalState === "RISK_OFF"
        ? "글로벌 환경은 보수적으로 해석하는 편이 좋습니다."
        : "글로벌 환경은 뚜렷한 방향성 없이 중립권입니다.";
  const localLine =
    payload.localState === "STRONG"
      ? "국내 시장은 지수와 내부 체력이 모두 강한 편입니다."
      : payload.localState === "SELECTIVE"
        ? "국내 시장은 특정 구간과 특정 주도군 중심으로 자금이 순환하고 있습니다."
        : payload.localState === "DEFENSIVE"
          ? "국내 시장은 추격보다 방어와 선별이 우선입니다."
          : "국내 시장은 반등과 약세가 혼재된 약한 상태입니다.";
  const topThemeLine = payload.topThemes.length
    ? `최근 강한 테마는 ${payload.topThemes.map((item) => item.label).join(", ")}입니다.`
    : "";
  const weakThemeLine = payload.bottomThemes.length
    ? `상대적으로 약한 테마는 ${payload.bottomThemes.map((item) => item.label).join(", ")}입니다.`
    : "";

  return [modeLine, globalLine, localLine, topThemeLine, weakThemeLine].filter(Boolean).join(" ");
}

function toMarketWatchMap(items: MarketWatchSnapshot[]) {
  return new Map(items.map((item) => [item.key, item] as const));
}

export async function getMarketFlowDashboard(options?: { forceRefresh?: boolean }): Promise<MarketFlowDashboardPayload> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedMarketFlow && cachedMarketFlow.expiresAt > now) {
    return cachedMarketFlow.payload;
  }

  logger.info("market-flow:build:start", {
    forceRefresh: options?.forceRefresh ?? false
  });

  const marketWatch = await getMarketWatchSnapshots();
  const marketWatchMap = toMarketWatchMap(marketWatch.items);
  const [themeRotation, global] = await Promise.all([
    getThemeRotationPayload({
      benchmarkSnapshots: marketWatchMap
    }),
    getGlobalCycleSnapshot({
      marketWatchItems: marketWatchMap
    })
  ]);
  const local = await getLocalCycleSnapshot({
    marketWatchItems: marketWatchMap,
    proxyMetrics: themeRotation.proxyMetrics
  });

  const marketMode = resolveMarketMode({
    globalState: global.state,
    localState: local.state
  });
  const interpretation = buildInterpretation({
    marketMode,
    globalState: global.state,
    localState: local.state,
    topThemes: themeRotation.topThemes,
    bottomThemes: themeRotation.bottomThemes
  });
  const payload: MarketFlowDashboardPayload = {
    generatedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE),
    marketMode,
    global,
    local,
    themeRotation: {
      generatedAt: themeRotation.generatedAt,
      score: themeRotation.score,
      maxScore: themeRotation.maxScore,
      themeCount: themeRotation.themeCount,
      snapshots: themeRotation.snapshots,
      history: themeRotation.history,
      topThemes: themeRotation.topThemes,
      bottomThemes: themeRotation.bottomThemes,
      notes: themeRotation.notes
    },
    interpretation,
    notes: [...global.notes, ...local.notes, ...themeRotation.notes]
  };

  try {
    await persistMarketFlowPayload(payload);
  } catch (error) {
    logger.warn("market-flow:persist:failed", {
      message: error instanceof Error ? error.message : "Failed to persist market flow payload."
    });
  }

  cachedMarketFlow = {
    expiresAt: Date.now() + MARKET_FLOW_CACHE_TTL_MS,
    payload
  };

  logger.info("market-flow:build:success", {
    marketMode: payload.marketMode,
    globalState: payload.global.state,
    localState: payload.local.state,
    themeCount: payload.themeRotation.themeCount
  });

  return payload;
}
