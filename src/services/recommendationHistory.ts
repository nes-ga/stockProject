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

function parseDateOnly(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
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
  const executedBuyCount = getExecutedBuyCount(historyCase);
  const returnPct = getReturnPct(historyCase);
  const firstBuyPrice = historyCase.buyPlan?.firstBuyPrice;
  const stopLossPrice = historyCase.buyPlan?.stopLossPrice;
  const latestClose = historyCase.latestClose;
  const targetReturnPct = getTargetReturnPct(executedBuyCount);
  const businessDaysSinceFirstBuy = countBusinessDaysBetween(getFirstExecutedBuyDate(historyCase), historyCase.dataDate);

  if (lifecycleStatus === "current") {
    return executedBuyCount > 0
      ? buildHistoryOutcome("active_entered", "진행 중", "active", true, "현재 추천 목록에 남아 있어 아직 종료하지 않습니다.")
      : buildHistoryOutcome("active_no_entry", "매수 전", "active", false, "아직 1차 매수가에 닿지 않아 수익률 통계에서 제외합니다.");
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
        "매수 전 제외",
        "excluded",
        false,
        `1차 매수가 대비 ${SWING_MISSED_UPSIDE_FROM_FIRST_BUY_PCT}% 이상 위로 이탈해 체결 없는 제외로 분류합니다.`
      );
    }

    return buildHistoryOutcome("entry_missed_upside", "매수 전 제외", "excluded", false, "체결 가정이 없어 수익률 통계에서 제외합니다.");
  }

  if (historyCase.outcomeStatus?.startsWith("target_hit_after") || (isFiniteNumber(returnPct) && returnPct >= targetReturnPct)) {
    return buildHistoryOutcome(
      "target_hit",
      "슈팅 수익",
      "profit",
      true,
      `평균 매수가 대비 목표 수익률 ${targetReturnPct}% 이상을 충족했습니다.`
    );
  }

  if (isFiniteNumber(stopLossPrice) && isFiniteNumber(latestClose) && latestClose <= stopLossPrice) {
    return buildHistoryOutcome("stop_broken", "손절 종료", "loss", true, "종가가 손절 기준을 하향 이탈했습니다.");
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
      `슈팅은 아니지만 평균 매수가 대비 ${SWING_DRIFT_PROFIT_RETURN_PCT}% 이상 수익권에서 매수 후보를 이탈했습니다.`
    );
  }

  if (businessDaysSinceFirstBuy >= SWING_STALE_TIMEOUT_BUSINESS_DAYS) {
    return buildHistoryOutcome(
      "stale_timeout",
      "시간 종료",
      "neutral",
      true,
      `첫 체결 후 ${SWING_STALE_TIMEOUT_BUSINESS_DAYS}거래일 이상 목표/손절 없이 후보에서 이탈했습니다.`
    );
  }

  return buildHistoryOutcome("closed_unknown", "종료", isFiniteNumber(returnPct) && returnPct < 0 ? "loss" : "neutral", true, "후보 목록에서 이탈해 종료 케이스로 분류합니다.");
}

function normalizeHistoryCaseWeightedBuys(historyCase: SwingHistoryCase): SwingHistoryCase {
  const averageBuyPrice = getWeightedAverageBuyPrice(historyCase.executedBuys);
  const latestClose = historyCase.latestClose;
  const buyPlan = historyCase.buyPlan ?? parseBuyPlan(historyCase.initialSnapshot?.note, historyCase.executedBuys);
  const unrealizedReturnPct =
    isFiniteNumber(averageBuyPrice) && isFiniteNumber(latestClose) && averageBuyPrice !== 0
      ? round(((latestClose - averageBuyPrice) / averageBuyPrice) * 100)
      : historyCase.unrealizedReturnPct;

  return {
    ...historyCase,
    assumption: getWeightedBuyAssumption(historyCase.assumption),
    buyPlan,
    averageBuyPrice: averageBuyPrice ?? historyCase.averageBuyPrice,
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

function buildCurrentHistoryCase(
  candidate: SwingCandidate & { profile: "default" | "smallcap"; sourceBucket: "execution" | "watch" },
  existingCase: SwingHistoryCase | undefined,
  now: Date
): SwingHistoryCase | undefined {
  const executedBuyCount = getExecutedBuyCount(candidate.postEntryOutcome);
  if (!candidate.symbol || !candidate.name) {
    return undefined;
  }

  const asOfDate = formatDateInSeoul(now);
  const openedDate = existingCase?.openedDate ?? asOfDate;
  const openedAt = existingCase?.openedAt ?? now.toISOString();
  const executedBuys = candidate.postEntryOutcome?.executedBuys ?? existingCase?.executedBuys ?? [];
  const averageBuyPrice = getWeightedAverageBuyPrice(executedBuys) ?? candidate.postEntryOutcome?.averageBuyPrice;
  const latestClose = candidate.postEntryOutcome?.latestClose;
  const buyPlan = parseBuyPlan(candidate.note, executedBuys) ?? existingCase?.buyPlan;
  if (executedBuyCount <= 0 && !buyPlan) {
    return undefined;
  }

  const unrealizedReturnPct =
    isFiniteNumber(latestClose) && isFiniteNumber(averageBuyPrice) && averageBuyPrice !== 0
      ? round(((latestClose - averageBuyPrice) / averageBuyPrice) * 100)
      : isFiniteNumber(candidate.postEntryOutcome?.unrealizedReturnPct)
        ? candidate.postEntryOutcome.unrealizedReturnPct
        : existingCase?.unrealizedReturnPct;

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
    dataDate: candidate.postEntryOutcome?.latestDate ?? candidate.latestMentionDate ?? candidate.anchorDate ?? asOfDate,
    entryBucket: candidate.bucket ?? candidate.sourceBucket,
    status: "active",
    assumption: getWeightedBuyAssumption(existingCase?.assumption),
    outcomeStatus: candidate.postEntryOutcome?.status ?? existingCase?.outcomeStatus,
    executedBuyCount,
    executedBuys,
    averageBuyPrice: isFiniteNumber(averageBuyPrice) ? averageBuyPrice : existingCase?.averageBuyPrice,
    latestClose: isFiniteNumber(latestClose) ? latestClose : existingCase?.latestClose,
    latestLow: isFiniteNumber(candidate.postEntryOutcome?.maxAdversePrice)
      ? candidate.postEntryOutcome.maxAdversePrice
      : existingCase?.latestLow,
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

function buildSwingHistorySummary(
  cases: SwingHistoryCase[],
  currentCandidates: Array<SwingCandidate & { sourceBucket: "execution" | "watch" }>
) {
  return {
    scannedExecutionCandidates: currentCandidates.filter((item) => item.sourceBucket === "execution").length,
    openedCases: cases.filter((item) => item.strategy === "swing").length,
    enteredCases: cases.filter((item) => getExecutedBuyCount(item) > 0).length,
    noEntryCases: cases.filter((item) => getExecutedBuyCount(item) <= 0).length,
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
    firstBuyOnlyCases: cases.filter((item) => getExecutedBuyCount(item) === 1).length,
    secondBuyReachedCases: cases.filter((item) => getExecutedBuyCount(item) >= 2).length,
    thirdBuyReachedCases: cases.filter((item) => getExecutedBuyCount(item) >= 3).length
  };
}

export async function updateSwingRecommendationHistoryFromCurrentPicks() {
  const now = new Date();
  const existingPayload = await readOptionalJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const existingCases = Array.isArray(existingPayload?.cases)
    ? existingPayload.cases.map(normalizeHistoryCaseWeightedBuys).filter((historyCase) => !isPennyStockHistoryCase(historyCase))
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
  const casesWithOutcome = cases.map((historyCase) => ({
    ...historyCase,
    historyOutcome: deriveHistoryOutcome(historyCase, currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) ? "current" : "closed")
  }));
  const asOfDate = formatDateInSeoul(now);
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
    cases: casesWithOutcome
  };

  await mkdir(path.dirname(swingHistoryPath), { recursive: true });
  await writeFile(swingHistoryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return {
    asOfDate,
    caseCount: cases.length,
    upsertedCaseCount,
    currentRecommendationCount: currentCandidates.length,
    currentEnteredRecommendationCount: currentCandidates.filter((candidate) => getExecutedBuyCount(candidate.postEntryOutcome) > 0).length
  };
}

export async function readSwingRecommendationHistory() {
  const payload = await readJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const cases = Array.isArray(payload.cases)
    ? payload.cases.map(normalizeHistoryCaseWeightedBuys).filter((historyCase) => !isPennyStockHistoryCase(historyCase))
    : [];
  const currentCandidates = await readCurrentSwingCandidates();
  const currentByProfileSymbol = new Map(
    currentCandidates.map((candidate) => [getCandidateKey(candidate.profile, candidate.symbol), candidate])
  );
  const currentBySymbol = new Map(currentCandidates.map((candidate) => [candidate.symbol, candidate]));

  const enrichedCases = cases.map((historyCase) => {
    const currentRecommendation =
      currentByProfileSymbol.get(getCandidateKey(historyCase.profile, historyCase.symbol)) ??
      currentBySymbol.get(historyCase.symbol);
    const lifecycleStatus = currentRecommendation ? "current" : "closed";

    return {
      ...historyCase,
      lifecycleStatus,
      historyOutcome: deriveHistoryOutcome(historyCase, lifecycleStatus),
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
  const historyCaseBySymbol = new Map(enrichedCases.map((historyCase) => [historyCase.symbol, historyCase]));
  const enrichedCurrentCandidates = currentCandidates.map((candidate) => {
    const historyCase =
      historyCaseByProfileSymbol.get(getCandidateKey(candidate.profile, candidate.symbol)) ??
      historyCaseBySymbol.get(candidate.symbol);
    const liveExecutedBuyCount = getExecutedBuyCount(candidate.postEntryOutcome);
    const historyExecutedBuyCount = getExecutedBuyCount(historyCase);
    const hasEntryAssumption = historyExecutedBuyCount > 0 || liveExecutedBuyCount > 0;

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
  const closedCaseCount = enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "closed").length;

  return {
    ...payload,
    cases: enrichedCases,
    currentCandidates: enteredCurrentCandidates,
    pendingEntryCandidates,
    closedCases: enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "closed"),
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
