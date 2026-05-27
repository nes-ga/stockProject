import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQuoteAndChart } from "./stockAnalysis.js";
import { readServerSwingPickPayload } from "./serverSwingPicks.js";
import type { ChartPoint } from "../types.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const swingHistoryPath = path.join(projectRoot, "data", "recommendation-history", "swing-history.json");
const SWING_MIN_REFERENCE_PRICE = 1000;
const SWING_TARGET_RETURN_PCT = 10;
const SWING_DEEP_ENTRY_TARGET_RETURN_PCT = 8;
const SWING_DRIFT_PROFIT_RETURN_PCT = 5;
const SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT = 7;
const SWING_STALE_TIMEOUT_BUSINESS_DAYS = 20;
const CLOSED_CASE_MARKET_REFRESH_SESSIONS = 80;
const swingSourceFiles = [
  { profile: "default", file: "server-swing-picks.json" },
  { profile: "smallcap", file: "server-smallcap-swing-picks.json" }
] as const;

type SwingCandidate = {
  key?: string;
  name?: string;
  symbol?: string;
  anchorDate?: string;
  latestMentionDate?: string;
  bucket?: string;
  note?: string;
  tags?: string[];
  reasons?: string[];
  category?: string;
  swingProfile?: string;
  source?: string;
  postEntryOutcome?: {
    status?: string;
    executedBuyCount?: number;
    executedBuys?: Array<{
      stage?: number;
      price?: number;
      date?: string;
    }>;
    averageBuyPrice?: number;
    latestClose?: number;
    latestDate?: string;
    unrealizedReturnPct?: number;
    maxAdversePrice?: number;
    maxFavorableReturnPct?: number;
    [key: string]: unknown;
  };
};

type SwingPickPayload = {
  executionItems?: SwingCandidate[];
  watchItems?: SwingCandidate[];
};

type SwingHistoryCase = {
  id?: string;
  strategy?: "swing";
  profile?: string;
  symbol?: string;
  name?: string;
  sourceKey?: string;
  openedAt?: string;
  openedDate?: string;
  closedDate?: string;
  closedMonth?: string;
  dataDate?: string;
  entryBucket?: string;
  status?: string;
  assumption?: {
    executionModel?: string;
    trigger?: string;
    note?: string;
    [key: string]: unknown;
  };
  executedBuyCount?: number;
  executedBuys?: Array<{
    stage?: number;
    price?: number;
    date?: string;
  }>;
  averageBuyPrice?: number;
  latestClose?: number;
  latestLow?: number;
  unrealizedReturnPct?: number;
  maxFavorablePrice?: number;
  maxFavorableDate?: string;
  maxFavorableReturnPct?: number;
  maxAdversePrice?: number;
  maxAdverseDate?: string;
  maxAdverseReturnPct?: number;
  outcomeStatus?: string;
  historyOutcome?: SwingHistoryOutcome;
  buyPlan?: {
    firstBuyPrice?: number;
    secondBuyPrice?: number;
    thirdBuyPrice?: number;
    stopLossPrice?: number;
  };
  initialSnapshot?: {
    anchorDate?: string;
    latestMentionDate?: string;
    note?: string;
    tags?: string[];
    reasons?: string[];
    source?: string;
  };
  [key: string]: unknown;
};

type SwingHistoryOutcomeType =
  | "active_entered"
  | "active_no_entry"
  | "target_hit"
  | "drift_profit_exit"
  | "entry_missed_upside"
  | "stop_broken"
  | "stale_timeout"
  | "closed_unknown";

type SwingHistoryOutcome = {
  type: SwingHistoryOutcomeType;
  label: string;
  category: "active" | "profit" | "loss" | "excluded" | "neutral";
  includeInReturnStats: boolean;
  description: string;
  returnBasis?: {
    result: "profit" | "loss" | "neutral" | "excluded";
    basisPriceLabel: string;
    basisPrice?: number;
    comparePriceLabel: string;
    comparePrice?: number;
    returnPct?: number;
    thresholdLabel?: string;
    thresholdPct?: number;
    stopLossPrice?: number;
  };
  closeBasis?: {
    lifecycleStatus: "current" | "closed";
    rule: string;
    sourceFiles: string[];
    includedBuckets: string[];
    matchKey?: string;
  };
};

type SwingHistoryPayload = {
  summary?: Record<string, unknown>;
  cases?: SwingHistoryCase[];
  [key: string]: unknown;
};

export type SwingCarryForwardCase = {
  profile: string;
  symbol: string;
  name: string;
  openedDate?: string;
  dataDate?: string;
  latestClose?: number;
  averageBuyPrice?: number;
  unrealizedReturnPct?: number;
  executedBuyCount: number;
  executedBuys?: Array<{
    stage?: number;
    price?: number;
    date?: string;
  }>;
  buyPlan?: SwingHistoryCase["buyPlan"];
  initialSnapshot?: SwingHistoryCase["initialSnapshot"];
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

function getCandidateKey(profile: string | undefined, symbol: string | undefined) {
  return `${profile ?? ""}:${symbol ?? ""}`;
}

function getExecutedBuyCount(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const count = (value as { executedBuyCount?: unknown }).executedBuyCount;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

function getExecutedBuyStageFromBuys(executedBuys: Array<{ stage?: number }> | undefined) {
  return Math.max(
    0,
    ...(executedBuys ?? [])
      .map((buy) => Number(buy.stage))
      .filter((stage) => Number.isFinite(stage) && stage > 0)
  );
}

function getExecutedBuyStage(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const executedBuys = (value as { executedBuys?: Array<{ stage?: number }> }).executedBuys;
  const stage = getExecutedBuyStageFromBuys(executedBuys);
  return stage > 0 ? stage : getExecutedBuyCount(value);
}

function formatDateInSeoul(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatSignedPercentText(value: number) {
  return `${value > 0 ? "+" : ""}${round(value, 2).toFixed(2)}%`;
}

function parseDateOnly(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getValidDateText(value: string | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function getMonthKey(value: string | undefined) {
  const validDate = getValidDateText(value);
  return validDate ? validDate.slice(0, 7) : undefined;
}

function getMonthLabel(month: string) {
  const [year, monthText] = month.split("-");
  return year && monthText ? `${year}년 ${monthText}월` : month;
}

function countBusinessDaysBetween(startDateText: string | undefined, endDateText: string | undefined) {
  const startDate = parseDateOnly(startDateText);
  const endDate = parseDateOnly(endDateText);
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(startDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor <= endDate) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

function parsePriceText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getKrxTickSize(price: number) {
  if (price < 2000) {
    return 1;
  }
  if (price < 5000) {
    return 5;
  }
  if (price < 20000) {
    return 10;
  }
  if (price < 50000) {
    return 50;
  }
  if (price < 200000) {
    return 100;
  }
  if (price < 500000) {
    return 500;
  }
  return 1000;
}

function roundPriceDownToTick(value: number) {
  const tickSize = getKrxTickSize(value);
  return Math.floor(value / tickSize) * tickSize;
}

function getExecutedBuyPrice(
  executedBuys: Array<{ stage?: number; price?: number }> | undefined,
  stage: number
) {
  const matchedBuy = (executedBuys ?? []).find((buy) => buy.stage === stage && isFiniteNumber(buy.price));
  return matchedBuy?.price;
}

function parseBuyPlan(
  note: string | undefined,
  executedBuys?: Array<{ stage?: number; price?: number }>
): SwingHistoryCase["buyPlan"] | undefined {
  if (!note) {
    return undefined;
  }

  const buyMatch = note.match(/매수\s+([\d,]+)\/([\d,]+)\/([\d,]+)/);
  const stopMatch = note.match(/손절\s+([\d,]+)/);
  const stopLossPrice = parsePriceText(stopMatch?.[1]);

  if (buyMatch) {
    const firstBuyPrice = parsePriceText(buyMatch[1]);
    const secondBuyPrice = parsePriceText(buyMatch[2]);
    const thirdBuyPrice = parsePriceText(buyMatch[3]);
    if (!firstBuyPrice && !secondBuyPrice && !thirdBuyPrice) {
      return undefined;
    }

    return {
      firstBuyPrice,
      secondBuyPrice,
      thirdBuyPrice,
      stopLossPrice
    };
  }

  const zoneMatch = note.match(/구간\s+([\d,]+)~([\d,]+)/);
  const zoneHighPrice = parsePriceText(zoneMatch?.[1]);
  if (!zoneHighPrice || !stopLossPrice || zoneHighPrice <= stopLossPrice) {
    return undefined;
  }

  const riskBand = zoneHighPrice - stopLossPrice;
  const secondBuyPrice = getExecutedBuyPrice(executedBuys, 2) ?? roundPriceDownToTick(stopLossPrice + riskBand * 0.67);
  const thirdBuyPrice = getExecutedBuyPrice(executedBuys, 3) ?? roundPriceDownToTick(stopLossPrice + riskBand * 0.33);

  return {
    firstBuyPrice: getExecutedBuyPrice(executedBuys, 1) ?? roundPriceDownToTick(zoneHighPrice),
    secondBuyPrice,
    thirdBuyPrice,
    stopLossPrice
  };
}

function getStagedBuyWeight(stage: unknown): number {
  if (stage === 3) {
    return 4;
  }
  if (stage === 2) {
    return 2;
  }
  return 1;
}

function getWeightedAverageBuyPrice(executedBuys: Array<{ stage?: number; price?: number }> | undefined) {
  const validBuys = (executedBuys ?? []).filter((buy): buy is { stage?: number; price: number } => isFiniteNumber(buy.price));
  const totalWeight = validBuys.reduce((sum, buy) => sum + getStagedBuyWeight(buy.stage), 0);
  if (!totalWeight) {
    return undefined;
  }

  return round(validBuys.reduce((sum, buy) => sum + buy.price * getStagedBuyWeight(buy.stage), 0) / totalWeight, 2);
}

function inferExecutedBuysFromLowTouch(
  buyPlan: SwingHistoryCase["buyPlan"] | undefined,
  latestLow: number | undefined,
  executedDate: string | undefined
): Array<{ stage: number; price: number; date?: string }> {
  if (!buyPlan || !isFiniteNumber(latestLow)) {
    return [];
  }

  return [
    { stage: 1, price: buyPlan.firstBuyPrice },
    { stage: 2, price: buyPlan.secondBuyPrice },
    { stage: 3, price: buyPlan.thirdBuyPrice }
  ]
    .filter((buy): buy is { stage: number; price: number } => isFiniteNumber(buy.price) && latestLow <= buy.price)
    .map((buy) => ({
      ...buy,
      date: executedDate
    }));
}

function getWeightedBuyAssumption(existing?: SwingHistoryCase["assumption"]) {
  return {
    ...(existing ?? {}),
    executionModel: "weighted_staged_buy",
    trigger: existing?.trigger ?? "daily_low_touched_buy_price",
    note: "일봉 저가가 각 분할 매수가를 터치하면 1차:2차:3차 = 1:2:4 금액 비중으로 체결된 것으로 가정합니다."
  };
}

function getTargetReturnPct(executedBuyCount: number) {
  return executedBuyCount >= 3 ? SWING_DEEP_ENTRY_TARGET_RETURN_PCT : SWING_TARGET_RETURN_PCT;
}

function getFirstExecutedBuyDate(historyCase: SwingHistoryCase) {
  return [...(historyCase.executedBuys ?? [])]
    .filter((buy) => isFiniteNumber(buy.stage) && typeof buy.date === "string")
    .sort((left, right) => Number(left.stage) - Number(right.stage))[0]?.date;
}

function getRecommendationStartDate(historyCase: SwingHistoryCase) {
  return (
    getValidDateText(historyCase.initialSnapshot?.anchorDate) ??
    getValidDateText(historyCase.openedDate) ??
    getValidDateText(historyCase.dataDate)
  );
}

function isDateOnOrAfter(value: string | undefined, startDate: string | undefined) {
  const validDate = getValidDateText(value);
  if (!startDate) {
    return Boolean(validDate);
  }

  return Boolean(validDate && validDate >= startDate);
}

function filterExecutedBuysAfterRecommendationStart(
  executedBuys: Array<{ stage?: number; price?: number; date?: string }> | undefined,
  recommendationStartDate: string | undefined
) {
  return (executedBuys ?? []).filter((buy) => isDateOnOrAfter(buy.date, recommendationStartDate));
}

function getReturnPct(historyCase: SwingHistoryCase) {
  if (isFiniteNumber(historyCase.unrealizedReturnPct)) {
    return historyCase.unrealizedReturnPct;
  }

  if (
    isFiniteNumber(historyCase.latestClose) &&
    isFiniteNumber(historyCase.averageBuyPrice) &&
    historyCase.averageBuyPrice !== 0
  ) {
    return round(((historyCase.latestClose - historyCase.averageBuyPrice) / historyCase.averageBuyPrice) * 100);
  }

  return undefined;
}

function calculateReturnPct(latestClose: number, averageBuyPrice: unknown) {
  if (!isFiniteNumber(averageBuyPrice) || averageBuyPrice === 0) {
    return undefined;
  }

  return round(((latestClose - averageBuyPrice) / averageBuyPrice) * 100);
}

function getMaxFavorableReturnPct(historyCase: SwingHistoryCase) {
  return isFiniteNumber(historyCase.maxFavorableReturnPct) ? historyCase.maxFavorableReturnPct : undefined;
}

function getPointHigh(point: ChartPoint) {
  return isFiniteNumber(point.high) && point.high > 0 ? point.high : point.close;
}

function getPointLow(point: ChartPoint) {
  return isFiniteNumber(point.low) && point.low > 0 ? point.low : point.close;
}

function getMarketRefreshStartDate(historyCase: SwingHistoryCase) {
  return getFirstExecutedBuyDate(historyCase) ?? getValidDateText(historyCase.openedDate) ?? getRecommendationStartDate(historyCase);
}

function getMarketRefreshEndDate(historyCase: SwingHistoryCase, asOfDate: string) {
  if (historyCase.status === "closed") {
    return getValidDateText(historyCase.closedDate) ?? getValidDateText(historyCase.dataDate) ?? asOfDate;
  }

  return asOfDate;
}

function sliceCaseMarketWindow(points: ChartPoint[], historyCase: SwingHistoryCase, asOfDate: string) {
  const startDate = getMarketRefreshStartDate(historyCase);
  const endDate = getMarketRefreshEndDate(historyCase, asOfDate);
  return points.filter((point) => (!startDate || point.date >= startDate) && point.date <= endDate);
}

function summarizeCaseMarketPath(points: ChartPoint[], historyCase: SwingHistoryCase, asOfDate: string) {
  const scopedPoints = sliceCaseMarketWindow(points, historyCase, asOfDate);
  const latestPoint = scopedPoints.at(-1);
  const averageBuyPrice = historyCase.averageBuyPrice;
  let maxFavorablePoint: ChartPoint | undefined;
  let maxFavorablePrice: number | undefined;
  let maxAdversePoint: ChartPoint | undefined;
  let maxAdversePrice: number | undefined;

  for (const point of scopedPoints) {
    const high = getPointHigh(point);
    if (!isFiniteNumber(maxFavorablePrice) || high > maxFavorablePrice) {
      maxFavorablePrice = high;
      maxFavorablePoint = point;
    }

    const low = getPointLow(point);
    if (!isFiniteNumber(maxAdversePrice) || low < maxAdversePrice) {
      maxAdversePrice = low;
      maxAdversePoint = point;
    }
  }

  return {
    latestPoint,
    maxFavorablePrice,
    maxFavorableDate: maxFavorablePoint?.date,
    maxFavorableReturnPct:
      isFiniteNumber(maxFavorablePrice) && isFiniteNumber(averageBuyPrice) && averageBuyPrice !== 0
        ? calculateReturnPct(maxFavorablePrice, averageBuyPrice)
        : undefined,
    maxAdversePrice,
    maxAdverseDate: maxAdversePoint?.date,
    maxAdverseReturnPct:
      isFiniteNumber(maxAdversePrice) && isFiniteNumber(averageBuyPrice) && averageBuyPrice !== 0
        ? calculateReturnPct(maxAdversePrice, averageBuyPrice)
        : undefined
  };
}

function buildHistoryOutcome(
  type: SwingHistoryOutcomeType,
  label: string,
  category: SwingHistoryOutcome["category"],
  includeInReturnStats: boolean,
  description: string,
  returnBasis?: SwingHistoryOutcome["returnBasis"],
  closeBasis?: SwingHistoryOutcome["closeBasis"]
): SwingHistoryOutcome {
  return {
    type,
    label,
    category,
    includeInReturnStats,
    description,
    returnBasis,
    closeBasis
  };
}

function deriveHistoryOutcome(historyCase: SwingHistoryCase, lifecycleStatus: "current" | "closed"): SwingHistoryOutcome {
  const executedBuyCount = getExecutedBuyStage(historyCase);
  const returnPct = getReturnPct(historyCase);
  const firstBuyPrice = historyCase.buyPlan?.firstBuyPrice;
  const stopLossPrice = historyCase.buyPlan?.stopLossPrice;
  const latestClose = historyCase.latestClose;
  const targetReturnPct = getTargetReturnPct(executedBuyCount);
  const maxFavorableReturnPct = getMaxFavorableReturnPct(historyCase);
  const businessDaysSinceFirstBuy = countBusinessDaysBetween(getFirstExecutedBuyDate(historyCase), historyCase.dataDate);
  const closeBasis: SwingHistoryOutcome["closeBasis"] = {
    lifecycleStatus,
    rule:
      lifecycleStatus === "current"
        ? "현재 매수 후보 또는 관찰 후보에 같은 종목이 남아 있어 진행 중으로 봅니다."
        : "현재 매수 후보와 관찰 후보 어디에도 같은 종목이 없어 후보 목록 이탈로 봅니다.",
    sourceFiles: swingSourceFiles.map((source) => `data/${source.file}`),
    includedBuckets: ["executionItems", "watchItems"],
    matchKey: getHistoryCaseKey(historyCase.profile, historyCase.symbol)
  };
  const maxFavorableDescription =
    isFiniteNumber(maxFavorableReturnPct) && isFiniteNumber(historyCase.maxFavorablePrice)
      ? ` 기간 중 최고가 ${formatKrw(historyCase.maxFavorablePrice)} 기준 최대 수익률 ${formatSignedPercentText(maxFavorableReturnPct)}입니다.`
      : "";
  const returnDescription =
    isFiniteNumber(returnPct) && isFiniteNumber(historyCase.averageBuyPrice) && isFiniteNumber(latestClose)
      ? `종료 기준가 ${formatKrw(latestClose)}, 평균 매수가 ${formatKrw(historyCase.averageBuyPrice)} 기준 수익률 ${formatSignedPercentText(returnPct)}입니다.`
      : "종료 기준 가격 또는 평균 매수가가 부족해 수익률 계산을 보류했습니다.";
  const latestCloseReturnBasis =
    isFiniteNumber(returnPct) && isFiniteNumber(historyCase.averageBuyPrice) && isFiniteNumber(latestClose)
      ? {
          result: returnPct > 0 ? ("profit" as const) : returnPct < 0 ? ("loss" as const) : ("neutral" as const),
          basisPriceLabel: "평균 매수가",
          basisPrice: historyCase.averageBuyPrice,
          comparePriceLabel: "종료 기준가",
          comparePrice: latestClose,
          returnPct
        }
      : undefined;

  if (lifecycleStatus === "current") {
    return executedBuyCount > 0
      ? buildHistoryOutcome("active_entered", "현재", "active", true, "현재 추천 목록에 남아 있어 아직 종료하지 않습니다.", undefined, closeBasis)
      : buildHistoryOutcome("active_no_entry", "현재 후보", "active", false, "현재 추천 목록에 남아 있으며 아직 체결 가정은 없습니다.", undefined, closeBasis);
  }

  if (executedBuyCount <= 0) {
    if (
      isFiniteNumber(latestClose) &&
      isFiniteNumber(firstBuyPrice) &&
      firstBuyPrice > 0 &&
      ((latestClose - firstBuyPrice) / firstBuyPrice) * 100 >= SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT
    ) {
      return buildHistoryOutcome(
        "entry_missed_upside",
        "미체결 제외",
        "excluded",
        false,
        `1차 매수가 대비 ${SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT}% 이상 위로 이탈해 체결 없는 제외로 분류합니다.`,
        {
          result: "excluded",
          basisPriceLabel: "1차 매수가",
          basisPrice: firstBuyPrice,
          comparePriceLabel: "종료 기준가",
          comparePrice: latestClose,
          returnPct: round(((latestClose - firstBuyPrice) / firstBuyPrice) * 100),
          thresholdLabel: "미체결 이탈 기준",
          thresholdPct: SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT
        },
        closeBasis
      );
    }

    return buildHistoryOutcome("entry_missed_upside", "미체결 제외", "excluded", false, "체결 가정이 없어 수익률 통계에서 제외합니다.", undefined, closeBasis);
  }

  if (historyCase.entryBucket === "watch" && executedBuyCount <= 0) {
    return buildHistoryOutcome(
      "closed_unknown",
      "관찰 종료",
      "neutral",
      false,
      `관찰 후보 목록에서 이탈해 종료 케이스로 분류합니다. 매수 후보가 아니어서 수익률 통계에서는 제외합니다. ${returnDescription}`,
      latestCloseReturnBasis,
      closeBasis
    );
  }

  if (
    historyCase.outcomeStatus?.startsWith("target_hit_after") ||
    // Target hits are based on the post-entry high path, not only the closing price.
    // A setup can finish as a profit even if the final close settles near the entry.
    (isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct) ||
    (isFiniteNumber(returnPct) && returnPct >= targetReturnPct)
  ) {
    return buildHistoryOutcome(
      "target_hit",
      "슈팅 수익",
      "profit",
      true,
      `평균 매수가 대비 목표 수익률 ${targetReturnPct}% 이상을 충족했습니다.${maxFavorableDescription} ${returnDescription}`,
      isFiniteNumber(historyCase.averageBuyPrice)
        ? {
            result: "profit",
            basisPriceLabel: "평균 매수가",
            basisPrice: historyCase.averageBuyPrice,
            comparePriceLabel:
              isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct ? "기간 중 최고가" : "종료 기준가",
            comparePrice:
              isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct
                ? historyCase.maxFavorablePrice
                : latestClose,
            returnPct:
              isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct ? maxFavorableReturnPct : returnPct,
            thresholdLabel: "목표 수익률",
            thresholdPct: targetReturnPct
          }
        : undefined,
      closeBasis
    );
  }

  if (isFiniteNumber(stopLossPrice) && isFiniteNumber(latestClose) && latestClose <= stopLossPrice) {
    return buildHistoryOutcome(
      "stop_broken",
      "손절 종료",
      "loss",
      true,
      `종가 ${formatKrw(latestClose)}이 손절가 ${formatKrw(stopLossPrice)} 이하로 내려왔습니다. ${returnDescription}`,
      latestCloseReturnBasis
        ? {
            ...latestCloseReturnBasis,
            result: "loss",
            thresholdLabel: "손절가",
            stopLossPrice
          }
        : undefined,
      closeBasis
    );
  }

  if (
    isFiniteNumber(returnPct) &&
    returnPct >= SWING_DRIFT_PROFIT_RETURN_PCT &&
    (!isFiniteNumber(firstBuyPrice) || !isFiniteNumber(latestClose) || latestClose >= firstBuyPrice * (1 + SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT / 100))
  ) {
    return buildHistoryOutcome(
      "drift_profit_exit",
      "완만 상승 종료",
      "profit",
      true,
      `슈팅은 아니지만 평균 매수가 대비 ${SWING_DRIFT_PROFIT_RETURN_PCT}% 이상 수익권에서 매수 후보를 이탈했습니다. ${returnDescription}`,
      latestCloseReturnBasis
        ? {
            ...latestCloseReturnBasis,
            result: "profit",
            thresholdLabel: "완만 상승 종료 기준",
            thresholdPct: SWING_DRIFT_PROFIT_RETURN_PCT
          }
        : undefined,
      closeBasis
    );
  }

  if (businessDaysSinceFirstBuy >= SWING_STALE_TIMEOUT_BUSINESS_DAYS) {
    return buildHistoryOutcome(
      "stale_timeout",
      "시간 종료",
      "neutral",
      true,
      `첫 체결 후 ${SWING_STALE_TIMEOUT_BUSINESS_DAYS}거래일 이상 목표/손절 없이 후보에서 이탈했습니다. ${returnDescription}`,
      latestCloseReturnBasis,
      closeBasis
    );
  }

  return buildHistoryOutcome(
    "closed_unknown",
    "종료",
    isFiniteNumber(returnPct) && returnPct < 0 ? "loss" : "neutral",
    true,
    `후보 목록에서 이탈해 종료 케이스로 분류합니다. ${returnDescription}`,
    latestCloseReturnBasis,
    closeBasis
  );
}

function normalizeHistoryCaseWeightedBuys(historyCase: SwingHistoryCase): SwingHistoryCase {
  const recommendationStartDate = getRecommendationStartDate(historyCase);
  const executedBuys = filterExecutedBuysAfterRecommendationStart(historyCase.executedBuys, recommendationStartDate);
  const averageBuyPrice = getWeightedAverageBuyPrice(executedBuys);
  const latestClose = historyCase.latestClose;
  const fallbackLatestClose = isFiniteNumber(latestClose) ? latestClose : isFiniteNumber(historyCase.latestLow) ? historyCase.latestLow : undefined;
  const buyPlan = historyCase.buyPlan ?? parseBuyPlan(historyCase.initialSnapshot?.note, executedBuys);
  const unrealizedReturnPct =
    isFiniteNumber(averageBuyPrice) && isFiniteNumber(fallbackLatestClose) && averageBuyPrice !== 0
      ? round(((fallbackLatestClose - averageBuyPrice) / averageBuyPrice) * 100)
      : executedBuys.length
        ? historyCase.unrealizedReturnPct
        : undefined;

  return {
    ...historyCase,
    assumption: getWeightedBuyAssumption(historyCase.assumption),
    buyPlan,
    executedBuyCount: getExecutedBuyStageFromBuys(executedBuys),
    executedBuys,
    averageBuyPrice: averageBuyPrice ?? (executedBuys.length ? historyCase.averageBuyPrice : undefined),
    latestClose: fallbackLatestClose,
    unrealizedReturnPct
  };
}

function isPennyStockPrice(value: unknown) {
  return isFiniteNumber(value) && value <= SWING_MIN_REFERENCE_PRICE;
}

function isPennyStockHistoryCase(historyCase: SwingHistoryCase) {
  return (
    isPennyStockPrice(historyCase.latestClose) ||
    isPennyStockPrice(historyCase.averageBuyPrice) ||
    isPennyStockPrice(historyCase.buyPlan?.firstBuyPrice)
  );
}

function isPennyStockCandidate(candidate: SwingCandidate) {
  return (
    isPennyStockPrice(candidate.postEntryOutcome?.latestClose) ||
    isPennyStockPrice(candidate.postEntryOutcome?.averageBuyPrice) ||
    (candidate.postEntryOutcome?.executedBuys ?? []).some((buy) => isPennyStockPrice(buy.price))
  );
}

function getHistoryCaseKey(profile: string | undefined, symbol: string | undefined) {
  return `${profile ?? ""}:${symbol ?? ""}`;
}

function isExecutionHistoryCase(historyCase: SwingHistoryCase) {
  return historyCase.entryBucket !== "watch";
}

function isActionableSwingCandidate(candidate: SwingCandidate) {
  return candidate.bucket !== "watch";
}

function buildCurrentHistoryCase(
  candidate: SwingCandidate & { profile: "default" | "smallcap"; sourceBucket: "execution" | "watch" },
  existingCase: SwingHistoryCase | undefined,
  now: Date
): SwingHistoryCase | undefined {
  if (!candidate.symbol || !candidate.name) {
    return undefined;
  }

  const asOfDate = formatDateInSeoul(now);
  const openedDate = existingCase?.openedDate ?? asOfDate;
  const openedAt = existingCase?.openedAt ?? now.toISOString();
  const recommendationStartDate = candidate.anchorDate ?? existingCase?.initialSnapshot?.anchorDate ?? openedDate;
  const sourceExecutedBuys = filterExecutedBuysAfterRecommendationStart(
    candidate.postEntryOutcome?.executedBuys ?? existingCase?.executedBuys ?? [],
    recommendationStartDate
  );
  const latestClose = candidate.postEntryOutcome?.latestClose;
  const buyPlan = parseBuyPlan(candidate.note, sourceExecutedBuys) ?? existingCase?.buyPlan;
  const dataDate = candidate.postEntryOutcome?.latestDate ?? candidate.latestMentionDate ?? candidate.anchorDate ?? asOfDate;
  const latestLow = isFiniteNumber(candidate.postEntryOutcome?.maxAdversePrice)
    ? candidate.postEntryOutcome.maxAdversePrice
    : existingCase?.latestLow;
  const inferredExecutedBuys =
    candidate.sourceBucket === "execution"
      ? inferExecutedBuysFromLowTouch(buyPlan, latestLow, dataDate)
      : [];
  const executedBuys = sourceExecutedBuys.length ? sourceExecutedBuys : inferredExecutedBuys;
  const averageBuyPrice = getWeightedAverageBuyPrice(executedBuys) ?? (executedBuys.length ? candidate.postEntryOutcome?.averageBuyPrice : undefined);
  if (executedBuys.length <= 0 && !buyPlan) {
    return undefined;
  }

  const unrealizedReturnPct =
    isFiniteNumber(latestClose) && isFiniteNumber(averageBuyPrice) && averageBuyPrice !== 0
      ? round(((latestClose - averageBuyPrice) / averageBuyPrice) * 100)
      : executedBuys.length && isFiniteNumber(candidate.postEntryOutcome?.unrealizedReturnPct)
        ? candidate.postEntryOutcome.unrealizedReturnPct
        : executedBuys.length
          ? existingCase?.unrealizedReturnPct
          : undefined;

  return {
    ...existingCase,
    id: existingCase?.id ?? `swing:${candidate.profile}:${candidate.symbol}:${openedDate}`,
    strategy: "swing",
    profile: candidate.profile,
    symbol: candidate.symbol,
    name: candidate.name,
    sourceKey: candidate.key ?? existingCase?.sourceKey ?? `${candidate.name}-${candidate.symbol}`,
    openedAt,
    openedDate,
    closedDate: undefined,
    closedMonth: undefined,
    dataDate,
    entryBucket: candidate.bucket ?? candidate.sourceBucket,
    status: "active",
    assumption: getWeightedBuyAssumption(existingCase?.assumption),
    outcomeStatus: candidate.postEntryOutcome?.status ?? existingCase?.outcomeStatus,
    executedBuyCount: getExecutedBuyStageFromBuys(executedBuys),
    executedBuys,
    averageBuyPrice: isFiniteNumber(averageBuyPrice) ? averageBuyPrice : existingCase?.averageBuyPrice,
    latestClose: isFiniteNumber(latestClose) ? latestClose : existingCase?.latestClose,
    latestLow,
    unrealizedReturnPct,
    buyPlan,
    initialSnapshot:
      existingCase?.initialSnapshot ??
      {
        anchorDate: candidate.anchorDate,
        latestMentionDate: candidate.latestMentionDate,
        note: candidate.note,
        tags: Array.isArray(candidate.tags) ? candidate.tags : [],
        reasons: Array.isArray(candidate.reasons) ? candidate.reasons : [],
        source: candidate.source
      }
  };
}

async function readCurrentSwingCandidates() {
  const candidates: Array<SwingCandidate & { profile: "default" | "smallcap"; sourceBucket: "execution" | "watch" }> = [];

  for (const source of swingSourceFiles) {
    const payload = await readServerSwingPickPayload(source.profile);
    const executionItems = payload.executionItems ?? [];
    const watchItems = payload.watchItems ?? [];

    candidates.push(
      ...executionItems.map((item) => ({
        ...item,
        profile: source.profile,
        sourceBucket: "execution" as const
      })),
      ...watchItems.map((item) => ({
        ...item,
        profile: source.profile,
        sourceBucket: "watch" as const
      }))
    );
  }

  return candidates.filter((item) => item.symbol && !isPennyStockCandidate(item));
}

function shouldUpsertCurrentHistoryCase(
  candidate: SwingCandidate & { sourceBucket: "execution" | "watch" },
  existingCase: SwingHistoryCase | undefined
) {
  // A downgrade from execution to watch is still a live swing case.
  // Keep existing/entered watch cases active until the stop or another real close condition is hit.
  // New watch-only names must not open history cases just because their low touched a staged buy level.
  return candidate.sourceBucket === "execution" || Boolean(existingCase);
}

function buildSwingHistorySummary(
  cases: SwingHistoryCase[],
  currentCandidates: Array<SwingCandidate & { sourceBucket: "execution" | "watch" }>
) {
  return {
    scannedExecutionCandidates: currentCandidates.filter((item) => item.sourceBucket === "execution").length,
    openedCases: cases.filter((item) => item.strategy === "swing").length,
    enteredCases: cases.filter((item) => getExecutedBuyStage(item) > 0).length,
    noEntryCases: cases.filter((item) => getExecutedBuyStage(item) <= 0).length,
    targetHitCases: cases.filter((item) => item.historyOutcome?.type === "target_hit").length,
    driftProfitExitCases: cases.filter((item) => item.historyOutcome?.type === "drift_profit_exit").length,
    profitExitCases: cases.filter(
      (item) => item.historyOutcome?.type === "target_hit" || item.historyOutcome?.type === "drift_profit_exit"
    ).length,
    entryMissedUpsideCases: cases.filter((item) => item.historyOutcome?.type === "entry_missed_upside").length,
    stopBrokenCases: cases.filter((item) => item.historyOutcome?.type === "stop_broken").length,
    staleTimeoutCases: cases.filter((item) => item.historyOutcome?.type === "stale_timeout").length,
    defaultCases: cases.filter((item) => item.profile === "default").length,
    smallcapCases: cases.filter((item) => item.profile === "smallcap").length,
    firstBuyOnlyCases: cases.filter((item) => getExecutedBuyStage(item) === 1).length,
    secondBuyReachedCases: cases.filter((item) => getExecutedBuyStage(item) >= 2).length,
    thirdBuyReachedCases: cases.filter((item) => getExecutedBuyStage(item) >= 3).length
  };
}

function enrichClosedDateFields(
  historyCase: SwingHistoryCase,
  lifecycleStatus: "current" | "closed",
  fallbackClosedDate: string | undefined
) {
  if (lifecycleStatus === "current") {
    return {
      ...historyCase,
      status: "active",
      closedDate: undefined,
      closedMonth: undefined
    };
  }

  const closedDate =
    getValidDateText(historyCase.closedDate) ??
    getValidDateText(fallbackClosedDate) ??
    getValidDateText(historyCase.dataDate) ??
    getValidDateText(historyCase.openedDate);

  return {
    ...historyCase,
    status: "closed",
    closedDate,
    closedMonth: getMonthKey(closedDate)
  };
}

function isStopBrokenHistoryCase(historyCase: SwingHistoryCase) {
  return (
    isFiniteNumber(historyCase.latestClose) &&
    isFiniteNumber(historyCase.buyPlan?.stopLossPrice) &&
    historyCase.latestClose <= historyCase.buyPlan.stopLossPrice
  );
}

function getEffectiveLifecycleStatus(
  historyCase: SwingHistoryCase,
  currentCaseKeys: Set<string>
): "current" | "closed" {
  if (isStopBrokenHistoryCase(historyCase)) {
    return "closed";
  }
  return currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) ? "current" : "closed";
}

function shouldRefreshMarketPrice(historyCase: SwingHistoryCase, asOfDate: string) {
  const entered = getExecutedBuyStage(historyCase) > 0;
  const closedEntered = historyCase.status === "closed" && entered;
  const activeEntered = historyCase.status === "active" && entered;
  const activeWithBuyPlan = historyCase.status === "active" && Boolean(historyCase.buyPlan);
  return Boolean(historyCase.symbol && (closedEntered || activeEntered || activeWithBuyPlan));
}

async function refreshCaseMarketPrice(historyCase: SwingHistoryCase, asOfDate: string) {
  if (!shouldRefreshMarketPrice(historyCase, asOfDate)) {
    return historyCase;
  }

  const symbol = historyCase.symbol;
  if (!symbol) {
    return historyCase;
  }

  try {
    const { points } = await fetchQuoteAndChart(symbol, {
      naverCount: CLOSED_CASE_MARKET_REFRESH_SESSIONS
    });
    const marketPath = summarizeCaseMarketPath(points, historyCase, asOfDate);
    const latestPoint = marketPath.latestPoint;
    if (!latestPoint || !isFiniteNumber(latestPoint.close)) {
      return historyCase;
    }

    return {
      ...historyCase,
      dataDate: latestPoint.date ?? historyCase.dataDate,
      latestClose: latestPoint.close,
      unrealizedReturnPct: calculateReturnPct(latestPoint.close, historyCase.averageBuyPrice),
      maxFavorablePrice: marketPath.maxFavorablePrice,
      maxFavorableDate: marketPath.maxFavorableDate,
      maxFavorableReturnPct: marketPath.maxFavorableReturnPct,
      maxAdversePrice: marketPath.maxAdversePrice,
      maxAdverseDate: marketPath.maxAdverseDate,
      maxAdverseReturnPct: marketPath.maxAdverseReturnPct
    };
  } catch {
    return historyCase;
  }
}

async function refreshCaseMarketPrices(cases: SwingHistoryCase[], asOfDate: string) {
  return Promise.all(cases.map((historyCase) => refreshCaseMarketPrice(historyCase, asOfDate)));
}

function buildClosedMonthSummaries(cases: SwingHistoryCase[]) {
  const grouped = new Map<string, SwingHistoryCase[]>();

  for (const historyCase of cases) {
    const month = historyCase.closedMonth ?? getMonthKey(historyCase.closedDate);
    if (!month) {
      continue;
    }
    grouped.set(month, [...(grouped.get(month) ?? []), historyCase]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, monthCases]) => {
      const returnStatsCases = monthCases.filter(
        (item) => getExecutedBuyStage(item) > 0 && item.historyOutcome?.includeInReturnStats !== false
      );
      const averageReturnPct = returnStatsCases.length
        ? round(returnStatsCases.reduce((sum, item) => sum + (getReturnPct(item) ?? 0), 0) / returnStatsCases.length)
        : undefined;

      return {
        month,
        label: getMonthLabel(month),
        closedCaseCount: monthCases.length,
        enteredCaseCount: monthCases.filter((item) => getExecutedBuyStage(item) > 0).length,
        noEntryCaseCount: monthCases.filter((item) => getExecutedBuyStage(item) <= 0).length,
        profitExitCaseCount: monthCases.filter(
          (item) => item.historyOutcome?.type === "target_hit" || item.historyOutcome?.type === "drift_profit_exit"
        ).length,
        stopBrokenCaseCount: monthCases.filter((item) => item.historyOutcome?.type === "stop_broken").length,
        averageReturnPct
      };
    });
}

// 중요: 이미 체결 가정이 생긴 스윙 케이스는 최신 스캔에서 새 패턴이
// 잡히지 않았다는 이유만으로 종료하면 안 됩니다. 손절, 목표 수익,
// 완만 상승 종료, 시간 종료, 명시적 제거가 나오기 전까지 watch로 유지합니다.
function shouldCarryForwardSwingCase(historyCase: SwingHistoryCase) {
  const executedBuyCount = getExecutedBuyStage(historyCase);
  if (
    executedBuyCount <= 0 ||
    !historyCase.profile ||
    !historyCase.symbol ||
    !historyCase.name ||
    !isExecutionHistoryCase(historyCase)
  ) {
    return false;
  }

  const latestClose = historyCase.latestClose;
  const stopLossPrice = historyCase.buyPlan?.stopLossPrice;
  if (isFiniteNumber(latestClose) && isFiniteNumber(stopLossPrice) && latestClose <= stopLossPrice) {
    return false;
  }

  const targetReturnPct = getTargetReturnPct(executedBuyCount);
  const returnPct = getReturnPct(historyCase);
  const maxFavorableReturnPct = getMaxFavorableReturnPct(historyCase);
  if (
    (isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct) ||
    (isFiniteNumber(returnPct) && returnPct >= targetReturnPct)
  ) {
    return false;
  }

  const businessDaysSinceFirstBuy = countBusinessDaysBetween(getFirstExecutedBuyDate(historyCase), historyCase.dataDate);
  return businessDaysSinceFirstBuy < SWING_STALE_TIMEOUT_BUSINESS_DAYS;
}

// recommendationUniverse가 현재 스윙 후보 파일을 덮어쓰기 전에 사용합니다.
// 펄어비스 같은 체결 케이스가 손절가 위에 있고 목표/시간 종료가 아닌데
// watchItems에서 사라지는 일을 막기 위한 보존 경로입니다.
export async function readSwingCarryForwardCases(profile?: string): Promise<SwingCarryForwardCase[]> {
  const existingPayload = await readOptionalJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const rawCases = Array.isArray(existingPayload?.cases)
    ? existingPayload.cases
        .map(normalizeHistoryCaseWeightedBuys)
        .filter((historyCase) => !isPennyStockHistoryCase(historyCase))
    : [];
  const asOfDate = formatDateInSeoul(new Date());
  const cases = await refreshCaseMarketPrices(
    rawCases.map((historyCase) => enrichClosedDateFields(historyCase, "current", asOfDate)),
    asOfDate
  );

  return cases
    .filter((historyCase) => shouldCarryForwardSwingCase(historyCase))
    .filter((historyCase) => !profile || historyCase.profile === profile)
    .map((historyCase) => ({
      profile: historyCase.profile as string,
      symbol: historyCase.symbol as string,
      name: historyCase.name as string,
      openedDate: historyCase.openedDate,
      dataDate: historyCase.dataDate,
      latestClose: historyCase.latestClose,
      averageBuyPrice: historyCase.averageBuyPrice,
      unrealizedReturnPct: historyCase.unrealizedReturnPct,
      executedBuyCount: getExecutedBuyStage(historyCase),
      executedBuys: historyCase.executedBuys,
      buyPlan: historyCase.buyPlan,
      initialSnapshot: historyCase.initialSnapshot
    }));
}
export async function updateSwingRecommendationHistoryFromCurrentPicks() {
  const now = new Date();
  const existingPayload = await readOptionalJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const existingCases = Array.isArray(existingPayload?.cases)
    ? existingPayload.cases
        .map(normalizeHistoryCaseWeightedBuys)
        .filter((historyCase) => !isPennyStockHistoryCase(historyCase))
    : [];
  const currentCandidates = await readCurrentSwingCandidates();
  const existingCaseByKey = new Map(
    existingCases.map((historyCase) => [getHistoryCaseKey(historyCase.profile, historyCase.symbol), historyCase])
  );
  const mergedCaseByKey = new Map(
    existingCases.map((historyCase) => [getHistoryCaseKey(historyCase.profile, historyCase.symbol), historyCase])
  );
  let upsertedCaseCount = 0;

  for (const candidate of currentCandidates) {
    const key = getHistoryCaseKey(candidate.profile, candidate.symbol);
    const existingCase = existingCaseByKey.get(key);
    if (!shouldUpsertCurrentHistoryCase(candidate, existingCase)) {
      continue;
    }

    const nextCase = buildCurrentHistoryCase(candidate, existingCase, now);
    if (!nextCase) {
      continue;
    }

    mergedCaseByKey.set(key, nextCase);
    upsertedCaseCount += 1;
  }

  const cases = [...mergedCaseByKey.values()].sort((left, right) => {
    const leftDate = String(left.openedDate ?? "");
    const rightDate = String(right.openedDate ?? "");
    if (rightDate !== leftDate) {
      return rightDate.localeCompare(leftDate);
    }
    return String(left.name ?? "").localeCompare(String(right.name ?? ""), "ko");
  });
  const currentCaseKeys = new Set(currentCandidates.map((candidate) => getHistoryCaseKey(candidate.profile, candidate.symbol)));
  const asOfDate = formatDateInSeoul(now);
  const casesWithClosedDate = cases.map((historyCase) => {
    const lifecycleStatus = currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) ? "current" : "closed";
    return enrichClosedDateFields(historyCase, lifecycleStatus, asOfDate);
  });
  const casesWithLatestMarketPrice = await refreshCaseMarketPrices(casesWithClosedDate, asOfDate);
  const casesWithOutcome = casesWithLatestMarketPrice.map((historyCase) => {
    const lifecycleStatus = getEffectiveLifecycleStatus(historyCase, currentCaseKeys);
    const caseWithLifecycle = enrichClosedDateFields(historyCase, lifecycleStatus, asOfDate);

    return {
      ...caseWithLifecycle,
      historyOutcome: deriveHistoryOutcome(caseWithLifecycle, lifecycleStatus)
    };
  });
  const currentEnteredRecommendationCount = casesWithOutcome.filter(
    (historyCase) => currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) && getExecutedBuyStage(historyCase) > 0
  ).length;
  const closedCases = casesWithOutcome.filter(
    (historyCase) => historyCase.status === "closed" && getExecutedBuyStage(historyCase) > 0 && isExecutionHistoryCase(historyCase)
  );
  const output: SwingHistoryPayload = {
    ...(existingPayload ?? {}),
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    asOfDate,
    scope: {
      strategy: "swing",
      profiles: ["default", "smallcap"],
      sourceFiles: swingSourceFiles.map((source) => `data/${source.file}`),
      includedBuckets: ["executionItems", "watchItems"],
      includeOnlyTouchedFirstBuy: true
    },
    summary: buildSwingHistorySummary(casesWithOutcome, currentCandidates),
    closedMonths: buildClosedMonthSummaries(closedCases),
    cases: casesWithOutcome
  };

  await mkdir(path.dirname(swingHistoryPath), { recursive: true });
  await writeFile(swingHistoryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return {
    asOfDate,
    caseCount: cases.length,
    upsertedCaseCount,
    currentRecommendationCount: currentCandidates.length,
    currentEnteredRecommendationCount
  };
}

export async function readSwingRecommendationHistory() {
  const payload = await readJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const cases = Array.isArray(payload.cases)
    ? payload.cases
        .map(normalizeHistoryCaseWeightedBuys)
        .filter((historyCase) => !isPennyStockHistoryCase(historyCase))
    : [];
  const currentCandidates = await readCurrentSwingCandidates();
  const currentByProfileSymbol = new Map(
    currentCandidates.map((candidate) => [getCandidateKey(candidate.profile, candidate.symbol), candidate])
  );
  const currentBySymbol = new Map(currentCandidates.map((candidate) => [candidate.symbol, candidate]));
  const currentCaseKeys = new Set(currentCandidates.map((candidate) => getHistoryCaseKey(candidate.profile, candidate.symbol)));

  const enrichedCases = cases.map((historyCase) => {
    const currentRecommendation =
      currentByProfileSymbol.get(getCandidateKey(historyCase.profile, historyCase.symbol)) ??
      (historyCase.profile ? undefined : currentBySymbol.get(historyCase.symbol));
    const lifecycleStatus = getEffectiveLifecycleStatus(historyCase, currentCaseKeys);
    const caseWithClosedDate = enrichClosedDateFields(historyCase, lifecycleStatus, payload.asOfDate as string | undefined);

    return {
      ...caseWithClosedDate,
      lifecycleStatus,
      historyOutcome: deriveHistoryOutcome(caseWithClosedDate, lifecycleStatus),
      currentRecommendation: lifecycleStatus === "current" && currentRecommendation
        ? {
            key: currentRecommendation.key,
            name: currentRecommendation.name,
            symbol: currentRecommendation.symbol,
            profile: currentRecommendation.profile,
            bucket: currentRecommendation.bucket ?? currentRecommendation.sourceBucket,
            sourceBucket: currentRecommendation.sourceBucket,
            anchorDate: currentRecommendation.anchorDate,
            latestMentionDate: currentRecommendation.latestMentionDate,
            source: currentRecommendation.source
          }
        : undefined
    };
  });

  const historyCaseByProfileSymbol = new Map(
    enrichedCases.map((historyCase) => [getCandidateKey(historyCase.profile as string | undefined, historyCase.symbol), historyCase])
  );
  const legacyHistoryCaseBySymbol = new Map(
    enrichedCases
      .filter((historyCase) => !historyCase.profile)
      .map((historyCase) => [historyCase.symbol, historyCase])
  );
  const enrichedCurrentCandidates = currentCandidates.map((candidate) => {
    const historyCase =
      historyCaseByProfileSymbol.get(getCandidateKey(candidate.profile, candidate.symbol)) ??
      legacyHistoryCaseBySymbol.get(candidate.symbol);
    const liveExecutedBuyCount = getExecutedBuyStage(candidate.postEntryOutcome);
    const historyExecutedBuyCount = getExecutedBuyStage(historyCase);
    const hasEntryAssumption = historyCase ? historyExecutedBuyCount > 0 : liveExecutedBuyCount > 0;

    return {
      key: candidate.key,
      name: candidate.name,
      symbol: candidate.symbol,
      profile: candidate.profile,
      bucket: candidate.bucket ?? candidate.sourceBucket,
      sourceBucket: candidate.sourceBucket,
      anchorDate: candidate.anchorDate,
      latestMentionDate: candidate.latestMentionDate,
      source: candidate.source,
      hasHistoryCase: Boolean(historyCase),
      hasEntryAssumption,
      postEntryOutcome: candidate.postEntryOutcome,
      historyCase
    };
  });
  const enteredCurrentCandidates = enrichedCurrentCandidates.filter((candidate) => candidate.hasEntryAssumption);
  const pendingEntryCandidates = enrichedCurrentCandidates.filter((candidate) => !candidate.hasEntryAssumption);

  const currentCaseCount = enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "current").length;
  const closedCases = enrichedCases.filter(
    (historyCase) =>
      historyCase.lifecycleStatus === "closed" && getExecutedBuyStage(historyCase) > 0 && isExecutionHistoryCase(historyCase)
  );
  const closedCaseCount = closedCases.length;

  return {
    ...payload,
    cases: enrichedCases,
    currentCandidates: enrichedCurrentCandidates,
    currentEnteredCandidates: enteredCurrentCandidates,
    pendingEntryCandidates,
    closedCases,
    closedMonths: buildClosedMonthSummaries(closedCases),
    summary: {
      ...(payload.summary ?? {}),
      currentRecommendationCount: currentCandidates.length,
      currentEnteredRecommendationCount: enteredCurrentCandidates.length,
      pendingEntryCandidateCount: pendingEntryCandidates.length,
      currentExecutionCount: currentCandidates.filter((candidate) => candidate.sourceBucket === "execution").length,
      currentWatchCount: currentCandidates.filter((candidate) => candidate.sourceBucket === "watch").length,
      currentCaseCount,
      closedCaseCount
    }
  };
}
