import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const swingHistoryPath = path.join(projectRoot, "data", "recommendation-history", "swing-history.json");
const SWING_MIN_REFERENCE_PRICE = 1000;
const SWING_TARGET_RETURN_PCT = 10;
const SWING_DEEP_ENTRY_TARGET_RETURN_PCT = 8;
const SWING_DRIFT_PROFIT_RETURN_PCT = 5;
const SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT = 7;
const SWING_STALE_TIMEOUT_BUSINESS_DAYS = 20;
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
};

type SwingHistoryPayload = {
  summary?: Record<string, unknown>;
  cases?: SwingHistoryCase[];
  [key: string]: unknown;
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

function buildHistoryOutcome(
  type: SwingHistoryOutcomeType,
  label: string,
  category: SwingHistoryOutcome["category"],
  includeInReturnStats: boolean,
  description: string
): SwingHistoryOutcome {
  return {
    type,
    label,
    category,
    includeInReturnStats,
    description
  };
}

function deriveHistoryOutcome(historyCase: SwingHistoryCase, lifecycleStatus: "current" | "closed"): SwingHistoryOutcome {
  const executedBuyCount = getExecutedBuyStage(historyCase);
  const returnPct = getReturnPct(historyCase);
  const firstBuyPrice = historyCase.buyPlan?.firstBuyPrice;
  const stopLossPrice = historyCase.buyPlan?.stopLossPrice;
  const latestClose = historyCase.latestClose;
  const targetReturnPct = getTargetReturnPct(executedBuyCount);
  const businessDaysSinceFirstBuy = countBusinessDaysBetween(getFirstExecutedBuyDate(historyCase), historyCase.dataDate);
  const returnDescription =
    isFiniteNumber(returnPct) && isFiniteNumber(historyCase.averageBuyPrice) && isFiniteNumber(latestClose)
      ? `종료 기준가 ${formatKrw(latestClose)}, 평균 매수가 ${formatKrw(historyCase.averageBuyPrice)} 기준 수익률 ${formatSignedPercentText(returnPct)}입니다.`
      : "종료 기준 가격 또는 평균 매수가가 부족해 수익률 계산을 보류했습니다.";

  if (lifecycleStatus === "current") {
    return executedBuyCount > 0
      ? buildHistoryOutcome("active_entered", "현재", "active", true, "현재 추천 목록에 남아 있어 아직 종료하지 않습니다.")
      : buildHistoryOutcome("active_no_entry", "현재 후보", "active", false, "현재 추천 목록에 남아 있으며 아직 체결 가정은 없습니다.");
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
        `1차 매수가 대비 ${SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT}% 이상 위로 이탈해 체결 없는 제외로 분류합니다.`
      );
    }

    return buildHistoryOutcome("entry_missed_upside", "미체결 제외", "excluded", false, "체결 가정이 없어 수익률 통계에서 제외합니다.");
  }

  if (historyCase.entryBucket === "watch") {
    return buildHistoryOutcome(
      "closed_unknown",
      "관찰 종료",
      "neutral",
      false,
      `관찰 후보 목록에서 이탈해 종료 케이스로 분류합니다. 매수 후보가 아니어서 수익률 통계에서는 제외합니다. ${returnDescription}`
    );
  }

  if (historyCase.outcomeStatus?.startsWith("target_hit_after") || (isFiniteNumber(returnPct) && returnPct >= targetReturnPct)) {
    return buildHistoryOutcome(
      "target_hit",
      "슈팅 수익",
      "profit",
      true,
      `평균 매수가 대비 목표 수익률 ${targetReturnPct}% 이상을 충족했습니다. ${returnDescription}`
    );
  }

  if (isFiniteNumber(stopLossPrice) && isFiniteNumber(latestClose) && latestClose <= stopLossPrice) {
    return buildHistoryOutcome(
      "stop_broken",
      "손절 종료",
      "loss",
      true,
      `종가 ${formatKrw(latestClose)}이 손절가 ${formatKrw(stopLossPrice)} 이하로 내려왔습니다. ${returnDescription}`
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
      `슈팅은 아니지만 평균 매수가 대비 ${SWING_DRIFT_PROFIT_RETURN_PCT}% 이상 수익권에서 매수 후보를 이탈했습니다. ${returnDescription}`
    );
  }

  if (businessDaysSinceFirstBuy >= SWING_STALE_TIMEOUT_BUSINESS_DAYS) {
    return buildHistoryOutcome(
      "stale_timeout",
      "시간 종료",
      "neutral",
      true,
      `첫 체결 후 ${SWING_STALE_TIMEOUT_BUSINESS_DAYS}거래일 이상 목표/손절 없이 후보에서 이탈했습니다. ${returnDescription}`
    );
  }

  return buildHistoryOutcome("closed_unknown", "종료", isFiniteNumber(returnPct) && returnPct < 0 ? "loss" : "neutral", true, `후보 목록에서 이탈해 종료 케이스로 분류합니다. ${returnDescription}`);
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
    const payload = await readJsonFile<SwingPickPayload>(path.join(projectRoot, "data", source.file));
    const executionItems = payload.executionItems ?? [];

    candidates.push(
      ...executionItems.map((item) => ({
        ...item,
        profile: source.profile,
        sourceBucket: "execution" as const
      }))
    );
  }

  return candidates.filter((item) => item.symbol && isActionableSwingCandidate(item) && !isPennyStockCandidate(item));
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
    const nextCase = buildCurrentHistoryCase(candidate, existingCaseByKey.get(key), now);
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
  const casesWithOutcome = cases.map((historyCase) => {
    const lifecycleStatus = currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) ? "current" : "closed";
    const caseWithClosedDate = enrichClosedDateFields(historyCase, lifecycleStatus, asOfDate);

    return {
      ...caseWithClosedDate,
      historyOutcome: deriveHistoryOutcome(caseWithClosedDate, lifecycleStatus)
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
      includedBuckets: ["executionItems"],
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

  const enrichedCases = cases.map((historyCase) => {
    const currentRecommendation =
      currentByProfileSymbol.get(getCandidateKey(historyCase.profile, historyCase.symbol)) ??
      (historyCase.profile ? undefined : currentBySymbol.get(historyCase.symbol));
    const lifecycleStatus = currentRecommendation ? "current" : "closed";
    const caseWithClosedDate = enrichClosedDateFields(historyCase, lifecycleStatus, payload.asOfDate as string | undefined);

    return {
      ...caseWithClosedDate,
      lifecycleStatus,
      historyOutcome: deriveHistoryOutcome(caseWithClosedDate, lifecycleStatus),
      currentRecommendation: currentRecommendation
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
