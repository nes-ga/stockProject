import { formatDateTimeInTimeZone, SEOUL_TIME_ZONE } from "../lib/dates.js";
import type { MarketFlowDashboardPayload, MarketFlowMode, MarketWatchSnapshot } from "../types.js";
import { createLogger } from "../lib/logger.js";
import { getMarketWatchSnapshots } from "./marketWatch.js";
import { getGlobalCycleSnapshot, getLocalCycleSnapshot } from "./marketCycleEngine.js";
import { persistMarketFlowPayload } from "./marketFlowHistory.js";
import { getThemeRotationPayload } from "./themeRotationEngine.js";
import { getMarketLiquiditySnapshot } from "./liquidityIndicators.js";

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
      ? "요약: 위험 선호와 국내 체력이 함께 강해 후보 검토 범위를 넓힐 수 있는 환경입니다."
      : payload.marketMode === "SELECTIVE"
        ? "요약: 전체 시장보다 주도 테마와 개별 종목 선별이 더 중요한 환경입니다."
        : payload.marketMode === "DEFENSIVE"
          ? "요약: 지수와 수급 부담이 커 신규 진입보다 보유 리스크 점검이 우선인 환경입니다."
          : "요약: 방향성이 충분히 확인되지 않아 기존 기준을 유지하며 관찰하는 환경입니다.";
  const globalLine =
    payload.globalState === "RISK_ON"
      ? "글로벌 지표는 위험자산 선호 쪽으로 기울어 있습니다."
      : payload.globalState === "RISK_OFF"
        ? "글로벌 지표는 보수적으로 해석해야 하는 상태입니다."
        : "글로벌 지표는 뚜렷한 방향성 없이 중립권입니다.";
  const localLine =
    payload.localState === "STRONG"
      ? "국내 지표는 지수와 내부 체력이 모두 강한 편입니다."
      : payload.localState === "SELECTIVE"
        ? "국내 지표는 특정 주도군 중심으로 자금이 순환하는 상태입니다."
        : payload.localState === "DEFENSIVE"
          ? "국내 지표는 추격보다 방어와 선별이 필요한 상태입니다."
          : "국내 지표는 반등과 약세가 혼재된 약한 상태입니다.";
  const topThemeLine = payload.topThemes.length
    ? `강세 테마: ${payload.topThemes.map((item) => item.label).join(", ")}.`
    : "";
  const weakThemeLine = payload.bottomThemes.length
    ? `약세 테마: ${payload.bottomThemes.map((item) => item.label).join(", ")}.`
    : "";
  const disclaimerLine = "이 요약은 매수·매도 신호가 아니라 추천 후보를 해석할 때 참고하는 시장 배경입니다.";

  return [modeLine, globalLine, localLine, topThemeLine, weakThemeLine, disclaimerLine].filter(Boolean).join(" ");
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
  const [themeRotation, global, liquidity] = await Promise.all([
    getThemeRotationPayload({
      benchmarkSnapshots: marketWatchMap
    }),
    getGlobalCycleSnapshot({
      marketWatchItems: marketWatchMap
    }),
    getMarketLiquiditySnapshot({
      forceRefresh: options?.forceRefresh
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
    liquidity,
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
    notes: [...global.notes, ...local.notes, ...themeRotation.notes, ...liquidity.notes]
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
