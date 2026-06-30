import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQuoteAndChart } from "./stockAnalysis.js";
import { readServerSwingPickPayload } from "./serverSwingPicks.js";
import { getMarketWatchSnapshots } from "./marketWatch.js";
import { discordAlertHistoryPath } from "./discordAlertHistory.js";
import type { ChartPoint, MarketWatchSnapshot, SmartMoneyEnvelopeAnalysis, SmartMoneyPenaltyFactor } from "../types.js";

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
const MARKET_SHOCK_GRACE_SESSIONS = 1;
const THIRD_BUY_MIN_STOP_BUFFER_PCT = 6;
const THIRD_BUY_RECLAIM_TIMEOUT_BUSINESS_DAYS = 5;
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
  penaltyFactors?: SmartMoneyPenaltyFactor[];
  envelope?: SmartMoneyEnvelopeAnalysis;
  category?: string;
  swingProfile?: string;
  source?: string;
  initialStopLossPrice?: number;
  buyPlan?: SwingHistoryCase["buyPlan"];
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
  initialStopLossPrice?: number;
  maxFavorablePrice?: number;
  maxFavorableDate?: string;
  maxFavorableReturnPct?: number;
  maxAdversePrice?: number;
  maxAdverseDate?: string;
  maxAdverseReturnPct?: number;
  outcomeStatus?: string;
  historyOutcome?: SwingHistoryOutcome;
  caseKind?: "active" | "entered" | "no_entry";
  displayGroup?: "진행 중" | "거래 완료" | "미진입 제외";
  returnStatsEligible?: boolean;
  cycleMeta?: SwingCycleMeta;
  marketStopGrace?: MarketStopGraceState;
  thirdBuyMonitor?: SwingThirdBuyMonitor;
  buyPlan?: {
    firstBuyPrice?: number;
    secondBuyPrice?: number;
    thirdBuyPrice?: number;
    stopLossPrice?: number;
    originalThirdBuyPrice?: number;
    adjustedThirdBuyPrice?: number;
    thirdBuyAdjustment?: {
      policy?: "market_stability_floor_confirmed";
      adjustedDate?: string;
      stopBufferPct?: number;
      supportHoldDays?: number;
      reason?: string;
    };
  };
  initialSnapshot?: {
    anchorDate?: string;
    latestMentionDate?: string;
    note?: string;
    tags?: string[];
    reasons?: string[];
    penaltyFactors?: SmartMoneyPenaltyFactor[];
    envelope?: SmartMoneyEnvelopeAnalysis;
    source?: string;
  };
  decisionSnapshot?: SwingDecisionSnapshot;
  stagedBuyDiagnostics?: SwingStagedBuyDiagnostics;
  outcomeDiagnostics?: SwingOutcomeDiagnostics;
  [key: string]: unknown;
};

type SwingCycleMeta = {
  cycleKey: string;
  cycleNo: number;
  cycleCount: number;
  previousCaseId?: string;
  nextCaseId?: string;
  previousOutcomeType?: string;
  previousClosedDate?: string;
  daysFromPreviousClose?: number | null;
  isRecoveryCycle: boolean;
  recoveryFromCaseId?: string;
  recoveryFromOutcome?: string;
  recoveryFromClosedDate?: string;
  daysFromRecoverySourceClose?: number | null;
};

type SwingDecisionSnapshot = {
  version: 1;
  capturedAt?: string;
  sourceBucket?: "execution" | "watch";
  entryBucket?: string;
  score?: number;
  referenceSma20?: number;
  envelope?: SmartMoneyEnvelopeAnalysis;
  tags: string[];
  reasons: string[];
  penaltyFactors: SmartMoneyPenaltyFactor[];
  source?: string;
  note?: string;
};

type SwingStagedBuyDiagnostics = {
  version: 1;
  executionModel: "weighted_staged_buy";
  weights: {
    stage1: 1;
    stage2: 2;
    stage3: 4;
  };
  buyPlan?: SwingHistoryCase["buyPlan"];
  riskBands?: {
    firstToStopPct?: number;
    secondToStopPct?: number;
    thirdToStopPct?: number;
    averageToStopPct?: number;
  };
  stageTouches: Array<{
    stage: 1 | 2 | 3;
    price?: number;
    touchedDate?: string;
    confirmedDate?: string;
    executedDate?: string;
    status: "executed" | "pending";
    mode: "low_touch" | "not_reached" | "confirmation_required" | "waiting_reclaim" | "stop_zone";
  }>;
  deepEntryPolicy: {
    thirdBuyRequiresConfirmation: boolean;
    thirdBuyMinStopBufferPct: number;
    blockThirdBuyOnMarketShock: boolean;
  };
};

type SwingThirdBuyMonitor = {
  version: 1;
  touchedDate?: string;
  confirmedDate?: string;
  adjustedThirdBuyPrice?: number;
  originalThirdBuyPrice?: number;
  adjustmentReason?: string;
  latestDate?: string;
  latestClose?: number;
  status: "not_reached" | "waiting_reclaim" | "confirmation_required" | "confirmed" | "stop_zone";
  reason: string;
};

type SwingOutcomeDiagnostics = {
  version: 1;
  latestDate?: string;
  latestClose?: number;
  executedBuyCount: number;
  averageBuyPrice?: number;
  unrealizedReturnPct?: number;
  maxFavorablePrice?: number;
  maxFavorableDate?: string;
  maxFavorableReturnPct?: number;
  maxAdversePrice?: number;
  maxAdverseDate?: string;
  maxAdverseReturnPct?: number;
  currentOutcome?: SwingHistoryOutcomeType;
};

type SwingHistoryOutcomeType =
  | "active_entered"
  | "active_no_entry"
  | "market_shock_grace"
  | "target_hit"
  | "deep_zone_rebound_exit"
  | "drift_profit_exit"
  | "entry_missed_upside"
  | "stop_broken"
  | "market_shock_stop"
  | "deep_zone_timeout_exit"
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

type SwingInitialAlertSnapshot = {
  anchorDate?: string;
  latestMentionDate?: string;
  note?: string;
  tags?: string[];
  reasons?: string[];
  penaltyFactors?: SmartMoneyPenaltyFactor[];
  envelope?: SmartMoneyEnvelopeAnalysis;
  source?: string;
  sentAt?: string;
};

type MarketShockLevel = "shock" | "crash";

type MarketShockContext = {
  active: boolean;
  date?: string;
  level?: MarketShockLevel;
  reasons: string[];
  indexChanges: {
    KOSPI?: number;
    KOSDAQ?: number;
    average1d?: number;
    average3d?: number;
    average5d?: number;
  };
};

type MarketStopGraceState = {
  status: "active" | "expired" | "recovered";
  startedDate?: string;
  lastCheckedDate?: string;
  shockDate?: string;
  level?: MarketShockLevel;
  expiresAfterSessions: number;
  reasons: string[];
  indexChanges?: MarketShockContext["indexChanges"];
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
  initialStopLossPrice?: number;
  initialSnapshot?: SwingHistoryCase["initialSnapshot"];
};

export type SwingHistoryWinRateGuardCandidate = {
  profile?: string;
  score?: number;
  tags?: string[];
  reasons?: string[];
  penaltyFactors?: SmartMoneyPenaltyFactor[];
  envelope?: SmartMoneyEnvelopeAnalysis;
  buyPlan?: SwingHistoryCase["buyPlan"];
  referenceClose?: number;
};

export type SwingHistoryWinRateConditionStats = {
  key: string;
  label: string;
  sampleSize: number;
  profitCount: number;
  lossCount: number;
  winRatePct: number;
  lossRatePct: number;
  avgReturnPct?: number;
  worstReturnPct?: number;
};

export type SwingHistoryWinRateGuardSignal = SwingHistoryWinRateConditionStats & {
  severity: "block" | "caution";
  reason: string;
};

export type SwingHistoryWinRateGuardEvaluation = {
  matchedSignals: SwingHistoryWinRateGuardSignal[];
  shouldBlockExecution: boolean;
  shouldCautionExecution: boolean;
  worstSignal?: SwingHistoryWinRateGuardSignal;
};

export type SwingHistoryWinRateGuardModel = {
  builtAt: string;
  closedSampleSize: number;
  conditions: Record<string, SwingHistoryWinRateConditionStats>;
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

function normalizePenaltyFactors(value: unknown): SmartMoneyPenaltyFactor[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SmartMoneyPenaltyFactor =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as { code?: unknown }).code === "string" &&
          typeof (item as { label?: unknown }).label === "string" &&
          isFiniteNumber((item as { impact?: unknown }).impact) &&
          typeof (item as { reason?: unknown }).reason === "string"
      )
    : [];
}

function normalizeEnvelope(value: unknown): SmartMoneyEnvelopeAnalysis | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const envelope = value as Partial<SmartMoneyEnvelopeAnalysis>;
  return typeof envelope.position === "string" &&
    isFiniteNumber(envelope.basis) &&
    isFiniteNumber(envelope.upper) &&
    isFiniteNumber(envelope.lower)
    ? (envelope as SmartMoneyEnvelopeAnalysis)
    : undefined;
}

async function readInitialSwingAlertSnapshots(): Promise<Map<string, SwingInitialAlertSnapshot>> {
  let raw = "";
  try {
    raw = await readFile(discordAlertHistoryPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return new Map();
    }
    throw error;
  }

  const snapshots = new Map<string, SwingInitialAlertSnapshot>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (record.alertType !== "recommendation-universe" || record.category !== "swing") {
      continue;
    }

    const profile = typeof record.profile === "string" ? record.profile : undefined;
    const symbol = typeof record.symbol === "string" ? record.symbol : undefined;
    if (!profile || !symbol) {
      continue;
    }

    const metadata = record.metadata && typeof record.metadata === "object"
      ? (record.metadata as Record<string, unknown>)
      : {};
    const note = typeof metadata.note === "string" ? metadata.note : undefined;
    if (!note) {
      continue;
    }

    const key = getHistoryCaseKey(profile, symbol);
    const existing = snapshots.get(key);
    const sentAt = typeof record.sentAt === "string" ? record.sentAt : "";
    if (existing?.sentAt && sentAt && existing.sentAt <= sentAt) {
      continue;
    }

    snapshots.set(key, {
      anchorDate: typeof record.anchorDate === "string"
        ? record.anchorDate
        : typeof metadata.anchorDate === "string"
          ? metadata.anchorDate
          : undefined,
      latestMentionDate: typeof record.latestMentionDate === "string"
        ? record.latestMentionDate
        : typeof metadata.latestMentionDate === "string"
          ? metadata.latestMentionDate
          : undefined,
      note,
      tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [],
      reasons: Array.isArray(metadata.reasons)
        ? metadata.reasons.filter((reason): reason is string => typeof reason === "string")
        : [],
      penaltyFactors: normalizePenaltyFactors(metadata.penaltyFactors),
      envelope: normalizeEnvelope(metadata.envelope),
      source: typeof metadata.source === "string" ? metadata.source : typeof record.source === "string" ? record.source : undefined,
      sentAt
    });
  }

  return snapshots;
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

function formatMarketShockLevel(level: MarketShockLevel | undefined) {
  return level === "crash" ? "붕괴" : "급락";
}

function averageNumbers(values: Array<number | undefined>) {
  const validValues = values.filter((value): value is number => isFiniteNumber(value));
  return validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : undefined;
}

const HISTORY_GUARD_REASON_KEYS = new Set([
  "deep_pullback_probe",
  "long_pullback_until_stop_probe",
  "execution_gate_overridden_by_envelope",
  "envelope_lower_break",
  "envelope_lower_hold",
  "unstable_support",
  "quality_not_ready",
  "probe_demoted_low_score_unstable_support",
  "risk_reward_thin",
  "sma20_slope_negative",
  "weak_candle_structure",
  "weak_volume_contraction"
]);

function getScoreBand(score: number | undefined) {
  if (!isFiniteNumber(score)) {
    return undefined;
  }

  if (score < 40) {
    return "score:<40";
  }

  if (score < 50) {
    return "score:40-49";
  }

  if (score < 60) {
    return "score:50-59";
  }

  if (score < 70) {
    return "score:60-69";
  }

  return "score:70+";
}

function labelHistoryGuardKey(key: string) {
  if (key.startsWith("tag:")) {
    return `tag ${key.slice("tag:".length)}`;
  }

  if (key.startsWith("reason:")) {
    return `reason ${key.slice("reason:".length)}`;
  }

  if (key.startsWith("penalty:")) {
    return `penalty ${key.slice("penalty:".length)}`;
  }

  if (key.startsWith("envelope:")) {
    return `envelope ${key.slice("envelope:".length)}`;
  }

  if (key.startsWith("combo:")) {
    return `combo ${key.slice("combo:".length).replace(/\+/g, " + ")}`;
  }

  if (key.startsWith("stage:")) {
    return `stage ${key.slice("stage:".length)}`;
  }

  return key;
}

function addHistoryGuardKey(keys: Set<string>, key: string | undefined) {
  if (key) {
    keys.add(key);
  }
}

function getCandidateStageLocation(candidate: Pick<SwingHistoryWinRateGuardCandidate, "buyPlan" | "referenceClose">) {
  const close = candidate.referenceClose;
  const buyPlan = candidate.buyPlan;
  if (!isFiniteNumber(close) || !buyPlan) {
    return undefined;
  }

  const thirdBuyPrice = buyPlan.thirdBuyPrice;
  const secondBuyPrice = buyPlan.secondBuyPrice;
  if (isFiniteNumber(thirdBuyPrice) && close <= thirdBuyPrice * 1.01) {
    return "stage:third_buy_reached";
  }

  if (isFiniteNumber(secondBuyPrice) && close <= secondBuyPrice * 1.01) {
    return "stage:second_buy_reached";
  }

  return undefined;
}

function buildHistoryGuardKeysFromSignals(input: {
  score?: number;
  entryBucket?: string;
  tags?: string[];
  reasons?: string[];
  penaltyFactors?: SmartMoneyPenaltyFactor[];
  envelope?: SmartMoneyEnvelopeAnalysis;
  stageKey?: string;
}) {
  const keys = new Set<string>();
  const tags = new Set(input.tags ?? []);
  const reasons = new Set(input.reasons ?? []);

  addHistoryGuardKey(keys, input.entryBucket ? `entry:${input.entryBucket}` : undefined);
  addHistoryGuardKey(keys, getScoreBand(input.score));
  addHistoryGuardKey(keys, input.envelope?.position ? `envelope:${input.envelope.position}` : undefined);
  addHistoryGuardKey(keys, input.stageKey);

  for (const tag of tags) {
    addHistoryGuardKey(keys, `tag:${tag}`);
  }

  for (const reason of reasons) {
    if (HISTORY_GUARD_REASON_KEYS.has(reason)) {
      addHistoryGuardKey(keys, `reason:${reason}`);
    }
  }

  for (const factor of input.penaltyFactors ?? []) {
    addHistoryGuardKey(keys, `penalty:${factor.code}`);
  }

  if (tags.has("tag_support_unstable") && reasons.has("long_pullback_until_stop_probe")) {
    addHistoryGuardKey(keys, "combo:unstable_support+long_pullback_until_stop");
  }

  if (tags.has("tag_support_unstable") && reasons.has("deep_pullback_probe")) {
    addHistoryGuardKey(keys, "combo:unstable_support+deep_pullback");
  }

  if (tags.has("tag_support_unstable") && input.envelope?.position === "below_lower") {
    addHistoryGuardKey(keys, "combo:unstable_support+below_lower_envelope");
  }

  if (input.stageKey === "stage:third_buy_reached" && tags.has("tag_support_unstable")) {
    addHistoryGuardKey(keys, "combo:third_buy+unstable_support");
  }

  if ((input.score ?? 100) < 60 && tags.has("tag_support_unstable")) {
    addHistoryGuardKey(keys, "combo:low_score+unstable_support");
  }

  return [...keys];
}

function buildHistoryGuardKeysFromCase(historyCase: SwingHistoryCase) {
  const snapshot = historyCase.decisionSnapshot;
  const executedStage = getExecutedBuyStage(historyCase);
  const stageKey = executedStage >= 3
    ? "stage:third_buy_reached"
    : executedStage >= 2
      ? "stage:second_buy_reached"
      : executedStage >= 1
        ? "stage:first_buy_reached"
        : undefined;

  return buildHistoryGuardKeysFromSignals({
    score: snapshot?.score,
    entryBucket: historyCase.entryBucket ?? snapshot?.entryBucket,
    tags: snapshot?.tags ?? historyCase.initialSnapshot?.tags,
    reasons: snapshot?.reasons ?? historyCase.initialSnapshot?.reasons,
    penaltyFactors: snapshot?.penaltyFactors ?? historyCase.initialSnapshot?.penaltyFactors,
    envelope: snapshot?.envelope ?? historyCase.initialSnapshot?.envelope,
    stageKey
  });
}

function buildHistoryGuardKeysFromCandidate(candidate: SwingHistoryWinRateGuardCandidate) {
  return buildHistoryGuardKeysFromSignals({
    score: candidate.score,
    tags: candidate.tags,
    reasons: candidate.reasons,
    penaltyFactors: candidate.penaltyFactors,
    envelope: candidate.envelope,
    stageKey: getCandidateStageLocation(candidate)
  });
}

function getHistoryGuardReturnPct(historyCase: SwingHistoryCase) {
  const returnBasisPct = historyCase.historyOutcome?.returnBasis?.returnPct;
  if (isFiniteNumber(returnBasisPct)) {
    return returnBasisPct;
  }

  return historyCase.outcomeDiagnostics?.unrealizedReturnPct ?? historyCase.unrealizedReturnPct;
}

export async function buildSwingHistoryWinRateGuardModel(): Promise<SwingHistoryWinRateGuardModel> {
  const payload = (await readOptionalJsonFile<SwingHistoryPayload>(swingHistoryPath)) ?? {};
  const conditions = new Map<
    string,
    {
      key: string;
      profitCount: number;
      lossCount: number;
      returns: number[];
    }
  >();
  let closedSampleSize = 0;

  for (const historyCase of payload.cases ?? []) {
    const category = historyCase.historyOutcome?.category;
    if (category !== "profit" && category !== "loss") {
      continue;
    }

    closedSampleSize += 1;
    const result = category === "profit" ? "profitCount" : "lossCount";
    const returnPct = getHistoryGuardReturnPct(historyCase);

    for (const key of buildHistoryGuardKeysFromCase(historyCase)) {
      const stats = conditions.get(key) ?? {
        key,
        profitCount: 0,
        lossCount: 0,
        returns: []
      };
      stats[result] += 1;
      if (isFiniteNumber(returnPct)) {
        stats.returns.push(returnPct);
      }
      conditions.set(key, stats);
    }
  }

  return {
    builtAt: new Date().toISOString(),
    closedSampleSize,
    conditions: Object.fromEntries(
      [...conditions.values()].map((stats) => {
        const sampleSize = stats.profitCount + stats.lossCount;
        const avgReturnPct = averageNumbers(stats.returns);
        const value: SwingHistoryWinRateConditionStats = {
          key: stats.key,
          label: labelHistoryGuardKey(stats.key),
          sampleSize,
          profitCount: stats.profitCount,
          lossCount: stats.lossCount,
          winRatePct: sampleSize > 0 ? round((stats.profitCount / sampleSize) * 100, 1) : 0,
          lossRatePct: sampleSize > 0 ? round((stats.lossCount / sampleSize) * 100, 1) : 0,
          avgReturnPct: avgReturnPct == null ? undefined : round(avgReturnPct, 2),
          worstReturnPct: stats.returns.length ? round(Math.min(...stats.returns), 2) : undefined
        };
        return [stats.key, value] as const;
      })
    )
  };
}

function toHistoryGuardSignal(stats: SwingHistoryWinRateConditionStats): SwingHistoryWinRateGuardSignal | undefined {
  const severeLossCluster =
    stats.sampleSize >= 4 &&
    stats.lossRatePct >= 65 &&
    (stats.avgReturnPct == null || stats.avgReturnPct <= -2);
  const smallButCleanLossCluster =
    stats.sampleSize >= 3 &&
    stats.lossRatePct >= 75 &&
    (stats.avgReturnPct == null || stats.avgReturnPct <= -4);
  const cautionCluster =
    stats.sampleSize >= 3 &&
    stats.lossRatePct >= 55 &&
    (stats.avgReturnPct == null || stats.avgReturnPct <= 0);

  if (severeLossCluster || smallButCleanLossCluster) {
    return {
      ...stats,
      severity: "block",
      reason: `${stats.label} 과거 표본 ${stats.sampleSize}건 중 손실 ${stats.lossCount}건, 승률 ${stats.winRatePct}%입니다.`
    };
  }

  if (cautionCluster) {
    return {
      ...stats,
      severity: "caution",
      reason: `${stats.label} 과거 표본 ${stats.sampleSize}건의 승률이 ${stats.winRatePct}%라 실행 강도를 낮춥니다.`
    };
  }

  return undefined;
}

export function evaluateSwingHistoryWinRateGuard(
  model: SwingHistoryWinRateGuardModel | undefined,
  candidate: SwingHistoryWinRateGuardCandidate
): SwingHistoryWinRateGuardEvaluation {
  if (!model || model.closedSampleSize < 8) {
    return {
      matchedSignals: [],
      shouldBlockExecution: false,
      shouldCautionExecution: false
    };
  }

  const matchedSignals = buildHistoryGuardKeysFromCandidate(candidate)
    .map((key) => model.conditions[key])
    .filter((stats): stats is SwingHistoryWinRateConditionStats => Boolean(stats))
    .map(toHistoryGuardSignal)
    .filter((signal): signal is SwingHistoryWinRateGuardSignal => Boolean(signal))
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "block" ? -1 : 1;
      }
      if (left.lossRatePct !== right.lossRatePct) {
        return right.lossRatePct - left.lossRatePct;
      }
      return right.sampleSize - left.sampleSize;
    })
    .slice(0, 4);
  const worstSignal = matchedSignals[0];

  return {
    matchedSignals,
    shouldBlockExecution: matchedSignals.some((signal) => signal.severity === "block"),
    shouldCautionExecution: matchedSignals.some((signal) => signal.severity === "caution"),
    worstSignal
  };
}

function percentChange(current: number | undefined, previous: number | undefined) {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous) || previous === 0) {
    return undefined;
  }
  return ((current - previous) / previous) * 100;
}

function roundOptionalPercent(value: number | undefined) {
  return isFiniteNumber(value) ? round(value, 2) : undefined;
}

function getMovingAverageAt(points: ChartPoint[], endIndex: number, period: number) {
  if (endIndex < period - 1) {
    return undefined;
  }

  return averageNumbers(points.slice(endIndex - period + 1, endIndex + 1).map((point) => point.close));
}

function findPointIndexAtOrBefore(points: ChartPoint[], date: string | undefined) {
  if (!date) {
    return points.length - 1;
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= date) {
      return index;
    }
  }

  return -1;
}

function deriveIndexShockMetrics(snapshot: MarketWatchSnapshot | undefined, date: string | undefined) {
  const points = snapshot?.chartSets?.daily?.points ?? [];
  const index = findPointIndexAtOrBefore(points, date);
  const latestPoint = index >= 0 ? points[index] : undefined;
  if (!latestPoint) {
    return undefined;
  }

  const previousPoint = points[index - 1];
  const prior3Point = points[index - 3];
  const prior5Point = points[index - 5];
  const sma20 = getMovingAverageAt(points, index, 20);
  const change1d = percentChange(latestPoint.close, previousPoint?.close);
  const change3d = percentChange(latestPoint.close, prior3Point?.close);
  const change5d = percentChange(latestPoint.close, prior5Point?.close);

  return {
    date: latestPoint.date,
    change1d,
    change3d,
    change5d,
    belowSma20: isFiniteNumber(sma20) ? latestPoint.close < sma20 : undefined
  };
}

function buildMarketShockContext(items: MarketWatchSnapshot[], date: string | undefined): MarketShockContext | undefined {
  const kospi = deriveIndexShockMetrics(items.find((item) => item.key === "KOSPI"), date);
  const kosdaq = deriveIndexShockMetrics(items.find((item) => item.key === "KOSDAQ"), date);
  if (!kospi && !kosdaq) {
    return undefined;
  }

  const average1d = averageNumbers([kospi?.change1d, kosdaq?.change1d]);
  const average3d = averageNumbers([kospi?.change3d, kosdaq?.change3d]);
  const average5d = averageNumbers([kospi?.change5d, kosdaq?.change5d]);
  const reasons: string[] = [];
  const oneDayCrash = [kospi?.change1d, kosdaq?.change1d].some((value) => isFiniteNumber(value) && value <= -4);
  const oneDayShock = [kospi?.change1d, kosdaq?.change1d].some((value) => isFiniteNumber(value) && value <= -2);
  const broadOneDayShock = isFiniteNumber(average1d) && average1d <= -1.8 && (kospi?.change1d ?? 0) < 0 && (kosdaq?.change1d ?? 0) < 0;
  const multiDayCrash = isFiniteNumber(average3d) && average3d <= -6;
  const multiDayShock = isFiniteNumber(average3d) && average3d <= -3.5;
  const belowSma20Selloff =
    kospi?.belowSma20 === true &&
    kosdaq?.belowSma20 === true &&
    isFiniteNumber(average5d) &&
    average5d <= -4;

  if (oneDayShock) {
    reasons.push("index_1d_shock");
  }
  if (broadOneDayShock) {
    reasons.push("broad_index_1d_selloff");
  }
  if (multiDayShock) {
    reasons.push("index_3d_shock");
  }
  if (belowSma20Selloff) {
    reasons.push("index_below_sma20_selloff");
  }

  const active = reasons.length > 0;
  return {
    active,
    date: [kosdaq?.date, kospi?.date].filter(Boolean).sort().at(-1),
    level: active ? (oneDayCrash || multiDayCrash ? "crash" : "shock") : undefined,
    reasons,
    indexChanges: {
      KOSPI: kospi?.change1d,
      KOSDAQ: kosdaq?.change1d,
      average1d,
      average3d,
      average5d
    }
  };
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

function getInitialStopLossPrice(historyCase: SwingHistoryCase) {
  return isFiniteNumber(historyCase.initialStopLossPrice) ? historyCase.initialStopLossPrice : undefined;
}

function freezeBuyPlanStopLoss(
  buyPlan: SwingHistoryCase["buyPlan"] | undefined,
  initialStopLossPrice: number | undefined
) {
  if (!buyPlan || !isFiniteNumber(initialStopLossPrice)) {
    return buyPlan;
  }

  return {
    ...buyPlan,
    stopLossPrice: initialStopLossPrice
  };
}

function mergeBuyPlanAdjustment(
  basePlan: SwingHistoryCase["buyPlan"] | undefined,
  incomingPlan: SwingHistoryCase["buyPlan"] | undefined
) {
  if (!basePlan) {
    return incomingPlan;
  }
  if (!incomingPlan?.adjustedThirdBuyPrice && !incomingPlan?.thirdBuyAdjustment) {
    return basePlan;
  }

  return {
    ...basePlan,
    originalThirdBuyPrice: basePlan.originalThirdBuyPrice ?? incomingPlan.originalThirdBuyPrice ?? basePlan.thirdBuyPrice,
    thirdBuyPrice: incomingPlan.adjustedThirdBuyPrice ?? incomingPlan.thirdBuyPrice ?? basePlan.thirdBuyPrice,
    adjustedThirdBuyPrice: incomingPlan.adjustedThirdBuyPrice ?? incomingPlan.thirdBuyPrice,
    thirdBuyAdjustment: incomingPlan.thirdBuyAdjustment
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
    { stage: 2, price: buyPlan.secondBuyPrice }
  ]
    .filter((buy): buy is { stage: number; price: number } => isFiniteNumber(buy.price) && latestLow <= buy.price)
    .map((buy) => ({
      ...buy,
      date: executedDate
    }));
}

function inferExecutedBuysFromMarketPath(
  buyPlan: SwingHistoryCase["buyPlan"] | undefined,
  points: ChartPoint[]
): Array<{ stage: number; price: number; date?: string }> {
  if (!buyPlan) {
    return [];
  }

  const stageDefinitions = [
    { stage: 1, price: buyPlan.firstBuyPrice },
    { stage: 2, price: buyPlan.secondBuyPrice }
  ].filter((buy): buy is { stage: number; price: number } => isFiniteNumber(buy.price));
  const executedBuys: Array<{ stage: number; price: number; date?: string }> = [];
  const executedStageSet = new Set<number>();

  for (const point of points) {
    const low = getPointLow(point);
    if (!isFiniteNumber(low)) {
      continue;
    }

    for (const buy of stageDefinitions) {
      if (!executedStageSet.has(buy.stage) && low <= buy.price) {
        executedStageSet.add(buy.stage);
        executedBuys.push({
          ...buy,
          date: point.date
        });
      }
    }
  }

  const thirdBuyMonitor = buildThirdBuyMonitor(buyPlan, points);
  if (thirdBuyMonitor?.status === "confirmed" && isFiniteNumber(buyPlan.thirdBuyPrice)) {
    executedBuys.push({
      stage: 3,
      price: thirdBuyMonitor.adjustedThirdBuyPrice ?? buyPlan.thirdBuyPrice,
      date: thirdBuyMonitor.confirmedDate
    });
  }

  return executedBuys;
}

function mergeExecutedBuysByStage(
  existingBuys: Array<{ stage?: number; price?: number; date?: string }> | undefined,
  inferredBuys: Array<{ stage?: number; price?: number; date?: string }>
) {
  const byStage = new Map<number, { stage: number; price: number; date?: string }>();

  for (const buy of inferredBuys) {
    if (isFiniteNumber(buy.stage) && isFiniteNumber(buy.price)) {
      byStage.set(Number(buy.stage), {
        stage: Number(buy.stage),
        price: buy.price,
        date: buy.date
      });
    }
  }

  for (const buy of existingBuys ?? []) {
    if (isFiniteNumber(buy.stage) && isFiniteNumber(buy.price) && Number(buy.stage) < 3) {
      byStage.set(Number(buy.stage), {
        stage: Number(buy.stage),
        price: buy.price,
        date: buy.date
      });
    }
  }

  return [...byStage.values()].sort((left, right) => left.stage - right.stage);
}

function parseNumberFromNote(note: string | undefined, pattern: RegExp) {
  const matched = note?.match(pattern);
  return parsePriceText(matched?.[1]);
}

function getBuyPlanStagePrice(buyPlan: SwingHistoryCase["buyPlan"] | undefined, stage: 1 | 2 | 3) {
  if (stage === 1) {
    return buyPlan?.firstBuyPrice;
  }
  if (stage === 2) {
    return buyPlan?.secondBuyPrice;
  }
  return buyPlan?.thirdBuyPrice;
}

function buildDecisionSnapshot(
  historyCase: SwingHistoryCase,
  currentCandidate?: SwingCandidate & { sourceBucket: "execution" | "watch" }
): SwingDecisionSnapshot {
  const initialSnapshot = historyCase.initialSnapshot;
  const note = currentCandidate?.note ?? initialSnapshot?.note ?? historyCase.decisionSnapshot?.note;
  return {
    version: 1,
    capturedAt: currentCandidate?.latestMentionDate ?? initialSnapshot?.latestMentionDate ?? historyCase.openedDate,
    sourceBucket: currentCandidate?.sourceBucket ?? historyCase.decisionSnapshot?.sourceBucket,
    entryBucket: historyCase.entryBucket,
    score: parseNumberFromNote(note, /점수\s+([\d,]+)/) ?? historyCase.decisionSnapshot?.score,
    referenceSma20: parseNumberFromNote(note, /SMA20\s+([\d,]+)/) ?? historyCase.decisionSnapshot?.referenceSma20,
    envelope: normalizeEnvelope(currentCandidate?.envelope) ?? initialSnapshot?.envelope ?? historyCase.decisionSnapshot?.envelope,
    tags: [
      ...new Set([
        ...(currentCandidate?.tags ?? []),
        ...(initialSnapshot?.tags ?? []),
        ...(historyCase.decisionSnapshot?.tags ?? [])
      ])
    ],
    reasons: [
      ...new Set([
        ...(currentCandidate?.reasons ?? []),
        ...(initialSnapshot?.reasons ?? []),
        ...(historyCase.decisionSnapshot?.reasons ?? [])
      ])
    ],
    penaltyFactors:
      normalizePenaltyFactors(currentCandidate?.penaltyFactors).length > 0
        ? normalizePenaltyFactors(currentCandidate?.penaltyFactors)
        : normalizePenaltyFactors(initialSnapshot?.penaltyFactors).length > 0
          ? normalizePenaltyFactors(initialSnapshot?.penaltyFactors)
          : normalizePenaltyFactors(historyCase.decisionSnapshot?.penaltyFactors),
    source: currentCandidate?.source ?? initialSnapshot?.source ?? historyCase.decisionSnapshot?.source,
    note
  };
}

function buildStagedBuyDiagnostics(historyCase: SwingHistoryCase): SwingStagedBuyDiagnostics {
  const buyPlan = historyCase.buyPlan;
  const stopLossPrice = buyPlan?.stopLossPrice;
  const executedByStage = new Map(
    (historyCase.executedBuys ?? [])
      .filter((buy) => isFiniteNumber(buy.stage))
      .map((buy) => [Number(buy.stage), buy])
  );

  return {
    version: 1,
    executionModel: "weighted_staged_buy",
    weights: {
      stage1: 1,
      stage2: 2,
      stage3: 4
    },
    buyPlan,
    riskBands:
      buyPlan && isFiniteNumber(stopLossPrice)
        ? {
            firstToStopPct: roundOptionalPercent(percentChange(stopLossPrice, buyPlan.firstBuyPrice)),
            secondToStopPct: roundOptionalPercent(percentChange(stopLossPrice, buyPlan.secondBuyPrice)),
            thirdToStopPct: roundOptionalPercent(percentChange(stopLossPrice, buyPlan.thirdBuyPrice)),
            averageToStopPct: roundOptionalPercent(percentChange(stopLossPrice, historyCase.averageBuyPrice))
          }
        : undefined,
    stageTouches: ([1, 2, 3] as const).map((stage) => {
      const executedBuy = executedByStage.get(stage);
      const price = isFiniteNumber(executedBuy?.price) ? executedBuy.price : getBuyPlanStagePrice(buyPlan, stage);
      const thirdBuyMonitor = stage === 3 ? historyCase.thirdBuyMonitor : undefined;
      const thirdPendingMode =
        thirdBuyMonitor?.status === "not_reached"
          ? "not_reached"
          : thirdBuyMonitor?.status === "waiting_reclaim"
          ? "waiting_reclaim"
          : thirdBuyMonitor?.status === "stop_zone"
            ? "stop_zone"
            : "confirmation_required";
      return {
        stage,
        price,
        touchedDate: executedBuy?.date ?? thirdBuyMonitor?.touchedDate,
        confirmedDate: executedBuy?.date,
        executedDate: executedBuy?.date,
        status: executedBuy ? "executed" : "pending",
        mode: stage === 3 && !executedBuy ? thirdPendingMode : "low_touch"
      };
    }),
    deepEntryPolicy: {
      thirdBuyRequiresConfirmation: true,
      thirdBuyMinStopBufferPct: 6,
      blockThirdBuyOnMarketShock: true
    }
  };
}

function buildOutcomeDiagnostics(historyCase: SwingHistoryCase): SwingOutcomeDiagnostics {
  return {
    version: 1,
    latestDate: historyCase.dataDate,
    latestClose: historyCase.latestClose,
    executedBuyCount: getExecutedBuyStage(historyCase),
    averageBuyPrice: historyCase.averageBuyPrice,
    unrealizedReturnPct: historyCase.unrealizedReturnPct,
    maxFavorablePrice: historyCase.maxFavorablePrice,
    maxFavorableDate: historyCase.maxFavorableDate,
    maxFavorableReturnPct: historyCase.maxFavorableReturnPct,
    maxAdversePrice: historyCase.maxAdversePrice,
    maxAdverseDate: historyCase.maxAdverseDate,
    maxAdverseReturnPct: historyCase.maxAdverseReturnPct,
    currentOutcome: historyCase.historyOutcome?.type
  };
}

function attachHistoryDiagnostics(
  historyCase: SwingHistoryCase,
  currentCandidate?: SwingCandidate & { sourceBucket: "execution" | "watch" }
): SwingHistoryCase {
  return {
    ...historyCase,
    decisionSnapshot: buildDecisionSnapshot(historyCase, currentCandidate),
    stagedBuyDiagnostics: buildStagedBuyDiagnostics(historyCase),
    outcomeDiagnostics: buildOutcomeDiagnostics(historyCase)
  };
}

function getWeightedBuyAssumption(existing?: SwingHistoryCase["assumption"]) {
  return {
    ...(existing ?? {}),
    executionModel: "weighted_staged_buy",
    trigger: "stage_1_2_low_touch_stage_3_reclaim_confirmation",
    note:
      "1차/2차는 일봉 저가가 매수가를 터치하면 체결로 보지만, 3차는 3차 가격 회복과 반등 확인 후에만 1:2:4 비중의 4를 실행한 것으로 봅니다."
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

function filterValidExecutedBuysAfterRecommendationStart(
  executedBuys: Array<{ stage?: number; price?: number; date?: string }> | undefined,
  recommendationStartDate: string | undefined
) {
  const filteredBuys = filterExecutedBuysAfterRecommendationStart(executedBuys, recommendationStartDate);
  return filteredBuys.some((buy) => Number(buy.stage) === 1) ? filteredBuys : [];
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

function isTargetHitHistoryCase(historyCase: SwingHistoryCase) {
  const targetReturnPct = getTargetReturnPct(getExecutedBuyStage(historyCase));
  const maxFavorableReturnPct = getMaxFavorableReturnPct(historyCase);
  const returnPct = getReturnPct(historyCase);
  return (
    getExecutedBuyStage(historyCase) > 0 &&
    (historyCase.outcomeStatus?.startsWith("target_hit_after") ||
      (isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct) ||
      (isFiniteNumber(returnPct) && returnPct >= targetReturnPct))
  );
}

function getTargetHitClosedDate(historyCase: SwingHistoryCase) {
  const targetReturnPct = getTargetReturnPct(getExecutedBuyStage(historyCase));
  const maxFavorableReturnPct = getMaxFavorableReturnPct(historyCase);
  if (isFiniteNumber(maxFavorableReturnPct) && maxFavorableReturnPct >= targetReturnPct) {
    return getValidDateText(historyCase.maxFavorableDate);
  }

  return getValidDateText(historyCase.dataDate);
}

function isThirdBuyUnconfirmedZone(historyCase: SwingHistoryCase) {
  return (
    getExecutedBuyStage(historyCase) === 2 &&
    (
      historyCase.thirdBuyMonitor?.status === "waiting_reclaim" ||
      historyCase.thirdBuyMonitor?.status === "confirmation_required" ||
      historyCase.thirdBuyMonitor?.status === "stop_zone"
    )
  );
}

function isDeepZoneReboundExit(historyCase: SwingHistoryCase) {
  const targetReturnPct = getTargetReturnPct(getExecutedBuyStage(historyCase));
  const maxFavorableReturnPct = getMaxFavorableReturnPct(historyCase);
  return (
    isThirdBuyUnconfirmedZone(historyCase) &&
    isFiniteNumber(targetReturnPct) &&
    isFiniteNumber(maxFavorableReturnPct) &&
    maxFavorableReturnPct >= targetReturnPct
  );
}

function getThirdBuyReclaimWaitDays(historyCase: SwingHistoryCase) {
  return countBusinessDaysBetween(historyCase.thirdBuyMonitor?.touchedDate, historyCase.dataDate);
}

function isDeepZoneTimeoutExit(historyCase: SwingHistoryCase) {
  return (
    isThirdBuyUnconfirmedZone(historyCase) &&
    !isDeepZoneReboundExit(historyCase) &&
    getThirdBuyReclaimWaitDays(historyCase) >= THIRD_BUY_RECLAIM_TIMEOUT_BUSINESS_DAYS
  );
}

function getPointHigh(point: ChartPoint) {
  return isFiniteNumber(point.high) && point.high > 0 ? point.high : point.close;
}

function getPointLow(point: ChartPoint) {
  return isFiniteNumber(point.low) && point.low > 0 ? point.low : point.close;
}

function getThirdBuyStopBufferPct(point: ChartPoint, buyPlan: SwingHistoryCase["buyPlan"]) {
  if (!isFiniteNumber(point.close) || !isFiniteNumber(buyPlan?.stopLossPrice) || point.close <= 0) {
    return undefined;
  }

  return ((point.close - buyPlan.stopLossPrice) / point.close) * 100;
}

function isThirdBuyConfirmationPoint(
  point: ChartPoint,
  previousPoint: ChartPoint | undefined,
  buyPlan: SwingHistoryCase["buyPlan"]
) {
  const thirdBuyPrice = buyPlan?.thirdBuyPrice;
  if (!isFiniteNumber(thirdBuyPrice) || !isFiniteNumber(point.close) || point.close < thirdBuyPrice) {
    return false;
  }

  const stopBufferPct = getThirdBuyStopBufferPct(point, buyPlan);
  if (!isFiniteNumber(stopBufferPct) || stopBufferPct < THIRD_BUY_MIN_STOP_BUFFER_PCT) {
    return false;
  }

  const greenCandle = isFiniteNumber(point.open) && point.close >= point.open;
  const closeRecovered = isFiniteNumber(previousPoint?.close) && point.close > previousPoint.close;
  return greenCandle || closeRecovered;
}

function getAdaptiveThirdBuyPrice(point: ChartPoint, buyPlan: SwingHistoryCase["buyPlan"]) {
  if (!isFiniteNumber(point.close) || !isFiniteNumber(buyPlan?.stopLossPrice)) {
    return undefined;
  }

  const minimumRiskTick = getKrxTickSize(point.close);
  return Math.max(roundPriceDownToTick(point.close), buyPlan.stopLossPrice + minimumRiskTick);
}

function isAdaptiveThirdBuyConfirmationPoint(
  point: ChartPoint,
  previousPoint: ChartPoint | undefined,
  recentPoints: ChartPoint[],
  buyPlan: SwingHistoryCase["buyPlan"]
) {
  const originalThirdBuyPrice = buyPlan?.originalThirdBuyPrice ?? buyPlan?.thirdBuyPrice;
  if (
    !isFiniteNumber(originalThirdBuyPrice) ||
    !isFiniteNumber(point.close) ||
    !isFiniteNumber(buyPlan?.stopLossPrice) ||
    point.close >= originalThirdBuyPrice ||
    point.close <= buyPlan.stopLossPrice
  ) {
    return false;
  }

  const adaptiveThirdBuyPrice = getAdaptiveThirdBuyPrice(point, buyPlan);
  if (!isFiniteNumber(adaptiveThirdBuyPrice) || !isFiniteNumber(buyPlan.secondBuyPrice)) {
    return false;
  }
  if (adaptiveThirdBuyPrice >= buyPlan.secondBuyPrice || adaptiveThirdBuyPrice <= buyPlan.stopLossPrice) {
    return false;
  }

  const stopBufferPct = getThirdBuyStopBufferPct(point, buyPlan);
  if (!isFiniteNumber(stopBufferPct) || stopBufferPct < THIRD_BUY_MIN_STOP_BUFFER_PCT) {
    return false;
  }

  const greenCandle = isFiniteNumber(point.open) && point.close >= point.open;
  const closeRecovered = isFiniteNumber(previousPoint?.close) && point.close > previousPoint.close;
  const supportWindow = recentPoints.slice(-3);
  const supportLows = supportWindow.map(getPointLow).filter(isFiniteNumber);
  const supportHeld =
    supportLows.length >= 3 &&
    Math.min(...supportLows) > buyPlan.stopLossPrice &&
    getPointLow(point) >= Math.min(...supportLows) * 0.985;

  return supportHeld && (greenCandle || closeRecovered);
}

function buildThirdBuyMonitor(
  buyPlan: SwingHistoryCase["buyPlan"] | undefined,
  points: ChartPoint[]
): SwingThirdBuyMonitor | undefined {
  if (!buyPlan || !isFiniteNumber(buyPlan.thirdBuyPrice)) {
    return undefined;
  }

  let touchedDate: string | undefined;
  let confirmedDate: string | undefined;
  let adjustedThirdBuyPrice: number | undefined;
  let adjustmentReason: string | undefined;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }

    if (!touchedDate && getPointLow(point) <= buyPlan.thirdBuyPrice) {
      touchedDate = point.date;
    }

    if (touchedDate && !confirmedDate && isThirdBuyConfirmationPoint(point, points[index - 1], buyPlan)) {
      confirmedDate = point.date;
    }

    if (
      touchedDate &&
      !confirmedDate &&
      isAdaptiveThirdBuyConfirmationPoint(point, points[index - 1], points.slice(Math.max(0, index - 2), index + 1), buyPlan)
    ) {
      confirmedDate = point.date;
      adjustedThirdBuyPrice = getAdaptiveThirdBuyPrice(point, buyPlan);
      adjustmentReason =
        "3차 원래 가격을 회복하지 못했지만 손절가 위에서 바닥 다짐과 반등 캔들이 확인되어 3차 매수가를 조정했습니다.";
    }
  }

  const latestPoint = points.at(-1);
  const latestClose = latestPoint?.close;
  if (confirmedDate) {
    return {
      version: 1,
      touchedDate,
      confirmedDate,
      adjustedThirdBuyPrice,
      originalThirdBuyPrice: adjustedThirdBuyPrice ? buyPlan.originalThirdBuyPrice ?? buyPlan.thirdBuyPrice : undefined,
      adjustmentReason,
      latestDate: latestPoint?.date,
      latestClose,
      status: "confirmed",
      reason: "3차 매수가 터치 후 종가가 3차 가격을 회복하고 반등 확인 조건을 충족했습니다."
    };
  }

  if (!touchedDate) {
    return {
      version: 1,
      latestDate: latestPoint?.date,
      latestClose,
      status: "not_reached",
      reason: "3차 매수가를 아직 터치하지 않았습니다."
    };
  }

  if (isFiniteNumber(latestClose) && isFiniteNumber(buyPlan.stopLossPrice) && latestClose <= buyPlan.stopLossPrice) {
    return {
      version: 1,
      touchedDate,
      latestDate: latestPoint?.date,
      latestClose,
      status: "stop_zone",
      reason: "3차 확인 전에 손절가 구간까지 밀려 3차 매수 실행을 막습니다."
    };
  }

  if (isFiniteNumber(latestClose) && latestClose < buyPlan.thirdBuyPrice) {
    return {
      version: 1,
      touchedDate,
      latestDate: latestPoint?.date,
      latestClose,
      status: "waiting_reclaim",
      reason: "3차 가격은 터치했지만 종가가 3차 매수가를 회복하지 못해 실행을 보류합니다."
    };
  }

  return {
    version: 1,
    touchedDate,
    latestDate: latestPoint?.date,
    latestClose,
    status: "confirmation_required",
    reason: "3차 가격은 터치했지만 반등 확인 조건이 부족해 실행을 보류합니다."
  };
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
  const marketStopGrace = historyCase.marketStopGrace;

  if (lifecycleStatus === "current") {
    if (isStopBrokenHistoryCase(historyCase) && marketStopGrace?.status === "active") {
      return buildHistoryOutcome(
        "market_shock_grace",
        "시장충격 유예",
        "active",
        true,
        `지수 ${formatMarketShockLevel(marketStopGrace.level)} 구간의 손절가 이탈이라 ${MARKET_SHOCK_GRACE_SESSIONS}거래일 확인 후 손절을 확정합니다. ${returnDescription}`,
        latestCloseReturnBasis
          ? {
              ...latestCloseReturnBasis,
              result: "loss",
              thresholdLabel: "시장충격 유예 손절가",
              stopLossPrice
            }
          : undefined,
        {
          ...closeBasis,
          rule: "손절가를 이탈했지만 KOSPI/KOSDAQ 시장 충격이 확인되어 1거래일 유예 상태로 유지합니다."
        }
      );
    }

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

  if (isDeepZoneReboundExit(historyCase)) {
    return buildHistoryOutcome(
      "deep_zone_rebound_exit",
      "딥존 반등 청산",
      "profit",
      true,
      `3차 매수가와 손절가 사이에서 3차 체결 확인 전 반등이 발생했습니다. 3차 비중은 넣지 않고 평균 매수가 ${formatKrw(historyCase.averageBuyPrice ?? 0)} 기준 기간 중 최고가 ${formatKrw(historyCase.maxFavorablePrice ?? 0)}에서 ${formatSignedPercentText(maxFavorableReturnPct ?? 0)}를 기록해 청산 수익으로 분류합니다.`,
      isFiniteNumber(maxFavorableReturnPct) && isFiniteNumber(historyCase.averageBuyPrice) && isFiniteNumber(historyCase.maxFavorablePrice)
        ? {
            result: "profit",
            basisPriceLabel: "2차 평균 매수가",
            basisPrice: historyCase.averageBuyPrice,
            comparePriceLabel: "기간 중 최고가",
            comparePrice: historyCase.maxFavorablePrice,
            returnPct: maxFavorableReturnPct,
            thresholdLabel: "딥존 반등 청산 기준",
            thresholdPct: targetReturnPct
          }
        : undefined,
      {
        ...closeBasis,
        rule: "3차 매수 확인 전 딥존에서 목표 수익 반등이 나와 현재 후보 잔류 여부와 무관하게 종료합니다."
      }
    );
  }

  if (isFiniteNumber(stopLossPrice) && isFiniteNumber(latestClose) && latestClose <= stopLossPrice) {
    if (marketStopGrace?.status === "expired") {
      return buildHistoryOutcome(
        "market_shock_stop",
        "시장 충격 손절",
        "loss",
        true,
        `시장충격 유예 후에도 종가 ${formatKrw(latestClose)}이 손절가 ${formatKrw(stopLossPrice)} 이하라 손절 종료로 확정합니다. ${returnDescription}`,
        latestCloseReturnBasis
          ? {
              ...latestCloseReturnBasis,
              result: "loss",
              thresholdLabel: "유예 후 손절가",
              stopLossPrice
            }
          : undefined,
        {
          ...closeBasis,
          rule: "시장 충격으로 1거래일 유예했지만 다음 확인에서도 손절가를 회복하지 못해 종료합니다."
        }
      );
    }

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
      {
        ...closeBasis,
        rule: "평균 매수가 기준 목표 수익률을 충족한 고가 경로가 확인되어 현재 후보 잔류 여부와 무관하게 슈팅 수익으로 종료합니다."
      }
    );
  }

  if (isDeepZoneTimeoutExit(historyCase)) {
    return buildHistoryOutcome(
      "deep_zone_timeout_exit",
      "딥존 장기체류",
      "loss",
      true,
      `3차 매수가와 손절가 사이에서 ${THIRD_BUY_RECLAIM_TIMEOUT_BUSINESS_DAYS}거래일 이상 회복하지 못했습니다. 3차 비중은 넣지 않고 2차 평균 기준 위험 종료로 분류합니다. ${returnDescription}`,
      latestCloseReturnBasis
        ? {
            ...latestCloseReturnBasis,
            result: latestCloseReturnBasis.result === "profit" ? "neutral" : "loss",
            thresholdLabel: `3차 회복 대기 한도 ${THIRD_BUY_RECLAIM_TIMEOUT_BUSINESS_DAYS}거래일`
          }
        : undefined,
      {
        ...closeBasis,
        rule: "3차 매수 확인 없이 딥존 체류가 길어져 현재 후보 잔류 여부와 무관하게 종료합니다."
      }
    );
  }

  if (
    historyCase.outcomeStatus?.startsWith("target_hit_after") ||
    // Target hits are based on the post-entry high path, not only the closing price.
    // Once the latest close is below the stop, stop handling must win over a prior run-up.
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
      {
        ...closeBasis,
        rule: "평균 매수가 기준 목표 수익률을 충족한 고가 경로가 확인되어 현재 후보 잔류 여부와 무관하게 슈팅 수익으로 종료합니다."
      }
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
  const executedBuys = isInitialWatchNoEntryCase(historyCase)
    ? []
    : filterValidExecutedBuysAfterRecommendationStart(historyCase.executedBuys, recommendationStartDate);
  const averageBuyPrice = getWeightedAverageBuyPrice(executedBuys);
  const latestClose = historyCase.latestClose;
  const fallbackLatestClose = isFiniteNumber(latestClose) ? latestClose : isFiniteNumber(historyCase.latestLow) ? historyCase.latestLow : undefined;
  const parsedBuyPlan = parseBuyPlan(historyCase.initialSnapshot?.note, executedBuys);
  const initialStopLossPrice = getInitialStopLossPrice(historyCase) ?? historyCase.buyPlan?.stopLossPrice ?? parsedBuyPlan?.stopLossPrice;
  const buyPlan = freezeBuyPlanStopLoss(historyCase.buyPlan ?? parsedBuyPlan, initialStopLossPrice);
  const unrealizedReturnPct =
    isFiniteNumber(averageBuyPrice) && isFiniteNumber(fallbackLatestClose) && averageBuyPrice !== 0
      ? round(((fallbackLatestClose - averageBuyPrice) / averageBuyPrice) * 100)
      : executedBuys.length
        ? historyCase.unrealizedReturnPct
        : undefined;

  return {
    ...historyCase,
    assumption: getWeightedBuyAssumption(historyCase.assumption),
    initialStopLossPrice,
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
  return historyCase.entryBucket !== "watch" || getExecutedBuyStage(historyCase) > 0;
}

function hasInitialWatchNoEntryGate(
  entryBucket: string | undefined,
  snapshot: { tags?: string[]; reasons?: string[] } | undefined
) {
  if (entryBucket !== "watch") {
    return false;
  }

  const reasons = new Set(snapshot?.reasons ?? []);
  const tags = new Set(snapshot?.tags ?? []);
  return reasons.has("entry_zone_pending") || tags.has("watch_low_quality");
}

function isInitialWatchNoEntryCase(historyCase: SwingHistoryCase | undefined) {
  return Boolean(
    historyCase && hasInitialWatchNoEntryGate(historyCase.entryBucket, historyCase.initialSnapshot)
  );
}

function hasFirstBuyAfterRecommendationStart(historyCase: SwingHistoryCase | undefined) {
  if (!historyCase || isInitialWatchNoEntryCase(historyCase)) {
    return false;
  }

  const recommendationStartDate = getRecommendationStartDate(historyCase);
  return filterValidExecutedBuysAfterRecommendationStart(historyCase.executedBuys, recommendationStartDate).some(
    (buy) => Number(buy.stage) === 1
  );
}

function isActionableSwingCandidate(candidate: SwingCandidate) {
  return candidate.bucket !== "watch";
}

function compareClosedHistoryCasePriority(left: SwingHistoryCase, right: SwingHistoryCase) {
  const leftDefaultProfile = left.profile === "default" ? 1 : 0;
  const rightDefaultProfile = right.profile === "default" ? 1 : 0;
  if (rightDefaultProfile !== leftDefaultProfile) {
    return rightDefaultProfile - leftDefaultProfile;
  }

  const leftExecutionBucket = left.entryBucket !== "watch" ? 1 : 0;
  const rightExecutionBucket = right.entryBucket !== "watch" ? 1 : 0;
  if (rightExecutionBucket !== leftExecutionBucket) {
    return rightExecutionBucket - leftExecutionBucket;
  }

  const leftClosedDate = getValidDateText(left.closedDate) ?? "";
  const rightClosedDate = getValidDateText(right.closedDate) ?? "";
  if (rightClosedDate !== leftClosedDate) {
    return rightClosedDate.localeCompare(leftClosedDate);
  }

  const leftOpenedDate = getValidDateText(left.openedDate) ?? "";
  const rightOpenedDate = getValidDateText(right.openedDate) ?? "";
  return rightOpenedDate.localeCompare(leftOpenedDate);
}

function dedupeClosedHistoryCases(cases: SwingHistoryCase[]) {
  const grouped = new Map<string, SwingHistoryCase[]>();
  for (const historyCase of cases) {
    const key = historyCase.symbol ?? historyCase.id ?? "";
    if (!key) {
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), historyCase]);
  }

  return [...grouped.values()]
    .map((items) => [...items].sort(compareClosedHistoryCasePriority)[0])
    .filter((item): item is SwingHistoryCase => Boolean(item))
    .sort((left, right) => {
      const leftClosedDate = getValidDateText(left.closedDate) ?? "";
      const rightClosedDate = getValidDateText(right.closedDate) ?? "";
      if (rightClosedDate !== leftClosedDate) {
        return rightClosedDate.localeCompare(leftClosedDate);
      }
      return String(left.name ?? "").localeCompare(String(right.name ?? ""), "ko");
    });
}

function buildCurrentHistoryCase(
  candidate: SwingCandidate & { profile: "default" | "smallcap"; sourceBucket: "execution" | "watch" },
  existingCase: SwingHistoryCase | undefined,
  now: Date,
  initialAlertSnapshot?: SwingInitialAlertSnapshot
): SwingHistoryCase | undefined {
  if (!candidate.symbol || !candidate.name) {
    return undefined;
  }

  const asOfDate = formatDateInSeoul(now);
  const openedDate = existingCase?.openedDate ?? initialAlertSnapshot?.anchorDate ?? asOfDate;
  const openedAt = existingCase?.openedAt ?? now.toISOString();
  const initialSnapshot =
    existingCase?.initialSnapshot ??
    (initialAlertSnapshot?.note
      ? {
          anchorDate: initialAlertSnapshot.anchorDate,
          latestMentionDate: initialAlertSnapshot.latestMentionDate,
          note: initialAlertSnapshot.note,
          tags: initialAlertSnapshot.tags ?? [],
          reasons: initialAlertSnapshot.reasons ?? [],
          penaltyFactors: initialAlertSnapshot.penaltyFactors ?? [],
          envelope: initialAlertSnapshot.envelope,
          source: initialAlertSnapshot.source
        }
      : undefined);
  const recommendationStartDate = initialSnapshot?.anchorDate ?? candidate.anchorDate ?? openedDate;
  const initialWatchNoEntry = hasInitialWatchNoEntryGate(
    candidate.bucket ?? candidate.sourceBucket,
    initialSnapshot ?? {
      tags: Array.isArray(candidate.tags) ? candidate.tags : [],
      reasons: Array.isArray(candidate.reasons) ? candidate.reasons : []
    }
  );
  const sourceExecutedBuys = initialWatchNoEntry
    ? []
    : filterValidExecutedBuysAfterRecommendationStart(
        candidate.postEntryOutcome?.executedBuys ?? existingCase?.executedBuys ?? [],
        recommendationStartDate
      ).filter((buy) => Number(buy.stage) < 3 || existingCase?.thirdBuyMonitor?.status === "confirmed");
  const latestClose = candidate.postEntryOutcome?.latestClose ?? existingCase?.latestClose;
  const buyPlanSourceBuys = initialSnapshot?.note ? existingCase?.executedBuys : sourceExecutedBuys;
  const parsedBuyPlan = parseBuyPlan(initialSnapshot?.note ?? candidate.note, buyPlanSourceBuys);
  const candidateInitialStopLossPrice = isFiniteNumber(candidate.initialStopLossPrice)
    ? candidate.initialStopLossPrice
    : undefined;
  const initialStopLossPrice =
    (existingCase ? getInitialStopLossPrice(existingCase) : undefined) ??
    parseBuyPlan(initialSnapshot?.note, buyPlanSourceBuys)?.stopLossPrice ??
    candidateInitialStopLossPrice ??
    existingCase?.buyPlan?.stopLossPrice ??
    parsedBuyPlan?.stopLossPrice;
  const buyPlan = freezeBuyPlanStopLoss(
    mergeBuyPlanAdjustment(
      getExecutedBuyStage(existingCase) > 0
        ? existingCase?.buyPlan ?? candidate.buyPlan ?? parsedBuyPlan
        : candidate.buyPlan ?? parsedBuyPlan ?? existingCase?.buyPlan,
      candidate.buyPlan
    ),
    initialStopLossPrice
  );
  const dataDate = candidate.postEntryOutcome?.latestDate ?? candidate.latestMentionDate ?? candidate.anchorDate ?? asOfDate;
  const latestLow = isFiniteNumber(candidate.postEntryOutcome?.maxAdversePrice)
    ? candidate.postEntryOutcome.maxAdversePrice
    : isFiniteNumber(existingCase?.latestLow)
      ? existingCase.latestLow
      : latestClose;
  // Only actionable scans may infer a fresh low-touch entry. Watch carry-forward
  // keeps already-entered cases current, but pending watch rows must not become
  // entries from aggregate low data.
  const inferredExecutedBuys =
    !initialWatchNoEntry && (candidate.sourceBucket === "execution" || hasFirstBuyAfterRecommendationStart(existingCase))
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
    initialStopLossPrice,
    outcomeStatus: candidate.postEntryOutcome?.status ?? existingCase?.outcomeStatus,
    executedBuyCount: getExecutedBuyStageFromBuys(executedBuys),
    executedBuys,
    averageBuyPrice: isFiniteNumber(averageBuyPrice) ? averageBuyPrice : existingCase?.averageBuyPrice,
    latestClose: isFiniteNumber(latestClose) ? latestClose : existingCase?.latestClose,
    latestLow,
    unrealizedReturnPct,
    buyPlan,
    thirdBuyMonitor: existingCase?.thirdBuyMonitor,
    initialSnapshot:
      initialSnapshot ??
      {
        anchorDate: candidate.anchorDate,
        latestMentionDate: candidate.latestMentionDate,
        note: candidate.note,
        tags: Array.isArray(candidate.tags) ? candidate.tags : [],
        reasons: Array.isArray(candidate.reasons) ? candidate.reasons : [],
        penaltyFactors: normalizePenaltyFactors(candidate.penaltyFactors),
        envelope: normalizeEnvelope(candidate.envelope),
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
  if (candidate.sourceBucket === "execution") {
    return true;
  }

  // watchItems are monitoring candidates by default. They only remain current
  // when this is an already-entered history case that has not hit a real close
  // condition yet.
  return hasFirstBuyAfterRecommendationStart(existingCase);
}

function getHistoryCaseKind(historyCase: SwingHistoryCase): SwingHistoryCase["caseKind"] {
  if (historyCase.status === "active" || historyCase.lifecycleStatus === "current") {
    return "active";
  }

  if (getExecutedBuyStage(historyCase) > 0) {
    return "entered";
  }

  return "no_entry";
}

function getHistoryCaseDisplayGroup(caseKind: SwingHistoryCase["caseKind"]): SwingHistoryCase["displayGroup"] {
  if (caseKind === "active") {
    return "진행 중";
  }
  if (caseKind === "entered") {
    return "거래 완료";
  }
  return "미진입 제외";
}

function getHistoryCaseReturnStatsEligible(historyCase: SwingHistoryCase, caseKind = getHistoryCaseKind(historyCase)) {
  if (caseKind !== "entered") {
    return false;
  }

  const explicitValue = historyCase.historyOutcome?.includeInReturnStats;
  if (typeof explicitValue === "boolean") {
    return explicitValue;
  }

  return true;
}

function enrichHistoryCaseClassification(historyCase: SwingHistoryCase): SwingHistoryCase {
  const caseKind = getHistoryCaseKind(historyCase);
  return {
    ...historyCase,
    caseKind,
    displayGroup: getHistoryCaseDisplayGroup(caseKind),
    returnStatsEligible: getHistoryCaseReturnStatsEligible(historyCase, caseKind)
  };
}

function isProfitExitHistoryCase(historyCase: SwingHistoryCase) {
  return (
    historyCase.historyOutcome?.type === "target_hit" ||
    historyCase.historyOutcome?.type === "deep_zone_rebound_exit" ||
    historyCase.historyOutcome?.type === "drift_profit_exit"
  );
}

function isStopOutcomeHistoryCase(historyCase: SwingHistoryCase) {
  return (
    historyCase.historyOutcome?.type === "stop_broken" ||
    historyCase.historyOutcome?.type === "market_shock_stop" ||
    historyCase.historyOutcome?.type === "deep_zone_timeout_exit"
  );
}

const cycleLossOutcomeTypes = new Set([
  "stop_broken",
  "market_shock_stop",
  "deep_zone_timeout_exit",
  "stop_loss",
  "loss_exit",
  "invalidated",
  "failed",
  "danger_exit"
]);

const cycleSuccessOutcomeTypes = new Set([
  "target_hit",
  "deep_zone_rebound_exit",
  "drift_profit_exit",
  "profit_exit",
  "target_reached",
  "shooting_profit",
  "upside_exit",
  "take_profit"
]);

function getCycleKey(historyCase: SwingHistoryCase) {
  return `${historyCase.strategy ?? "swing"}:${historyCase.profile ?? ""}:${historyCase.symbol ?? ""}`;
}

function getCycleCaseId(historyCase: SwingHistoryCase) {
  return historyCase.id ?? `${getCycleKey(historyCase)}:${historyCase.openedDate ?? historyCase.dataDate ?? ""}`;
}

function getCycleSortDate(historyCase: SwingHistoryCase) {
  return getValidDateText(historyCase.openedDate) ?? getValidDateText(historyCase.initialSnapshot?.anchorDate) ?? getValidDateText(historyCase.dataDate) ?? "";
}

function compareCycleCases(
  left: { historyCase: SwingHistoryCase; index: number },
  right: { historyCase: SwingHistoryCase; index: number }
) {
  const leftDate = getCycleSortDate(left.historyCase);
  const rightDate = getCycleSortDate(right.historyCase);
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftId = getCycleCaseId(left.historyCase);
  const rightId = getCycleCaseId(right.historyCase);
  if (leftId !== rightId) {
    return leftId.localeCompare(rightId);
  }

  return left.index - right.index;
}

function getCycleDateTime(value: string | undefined) {
  const validDate = getValidDateText(value);
  if (!validDate) {
    return undefined;
  }

  const date = new Date(`${validDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function getCalendarDaysBetween(startDate: string | undefined, endDate: string | undefined) {
  const startTime = getCycleDateTime(startDate);
  const endTime = getCycleDateTime(endDate);
  if (startTime == null || endTime == null) {
    return null;
  }

  return Math.round((endTime - startTime) / (24 * 60 * 60 * 1000));
}

function getCycleClosedDateFallback(historyCase: SwingHistoryCase | undefined) {
  return (
    getValidDateText(historyCase?.closedDate) ??
    getValidDateText(historyCase?.openedDate) ??
    getValidDateText(historyCase?.dataDate)
  );
}

function getCycleOutcomeType(historyCase: SwingHistoryCase | undefined) {
  return historyCase?.historyOutcome?.type;
}

function getCycleReturnPct(historyCase: SwingHistoryCase) {
  const returnBasisPct = historyCase.historyOutcome?.returnBasis?.returnPct;
  if (isFiniteNumber(returnBasisPct)) {
    return returnBasisPct;
  }

  const realizedReturnPct = historyCase.realizedReturnPct;
  if (isFiniteNumber(realizedReturnPct)) {
    return realizedReturnPct;
  }

  return getReturnPct(historyCase);
}

function isNoEntryCycleCase(historyCase: SwingHistoryCase) {
  return historyCase.caseKind === "no_entry" || (historyCase.status === "closed" && getExecutedBuyStage(historyCase) <= 0);
}

function isCycleLossExitCase(historyCase: SwingHistoryCase) {
  if (isNoEntryCycleCase(historyCase) || getExecutedBuyStage(historyCase) <= 0 || historyCase.status !== "closed") {
    return false;
  }

  const outcomeType = getCycleOutcomeType(historyCase);
  if (outcomeType && cycleLossOutcomeTypes.has(outcomeType)) {
    return true;
  }

  if (historyCase.historyOutcome?.category === "loss") {
    return true;
  }

  return outcomeType === "closed_unknown" && (getCycleReturnPct(historyCase) ?? 0) < 0;
}

function isCycleSuccessCase(historyCase: SwingHistoryCase) {
  const outcomeType = getCycleOutcomeType(historyCase);
  return Boolean(
    outcomeType && cycleSuccessOutcomeTypes.has(outcomeType)
  ) || historyCase.historyOutcome?.category === "profit";
}

function findRecoverySourceCycleCase(previousCases: SwingHistoryCase[]) {
  for (let index = previousCases.length - 1; index >= 0; index -= 1) {
    const previousCase = previousCases[index];
    if (previousCase && isCycleLossExitCase(previousCase)) {
      return previousCase;
    }
  }

  return undefined;
}

function attachCycleMetaToCases(cases: SwingHistoryCase[]): SwingHistoryCase[] {
  const grouped = new Map<string, Array<{ historyCase: SwingHistoryCase; index: number }>>();
  cases.forEach((historyCase, index) => {
    const cycleKey = getCycleKey(historyCase);
    grouped.set(cycleKey, [...(grouped.get(cycleKey) ?? []), { historyCase, index }]);
  });

  const cycleMetaByIndex = new Map<number, SwingCycleMeta>();

  for (const [cycleKey, groupCases] of grouped.entries()) {
    const sortedCases = [...groupCases].sort(compareCycleCases);
    const cycleCount = sortedCases.length;

    sortedCases.forEach(({ historyCase, index }, sortedIndex) => {
      const previousCase = sortedCases[sortedIndex - 1]?.historyCase;
      const nextCase = sortedCases[sortedIndex + 1]?.historyCase;
      const previousClosedDate = getCycleClosedDateFallback(previousCase);
      const currentOpenDate = getCycleSortDate(historyCase);
      const daysFromPreviousClose = previousCase ? getCalendarDaysBetween(previousClosedDate, currentOpenDate) : null;
      const recoverySource = !isNoEntryCycleCase(historyCase)
        ? findRecoverySourceCycleCase(sortedCases.slice(0, sortedIndex).map((item) => item.historyCase))
        : undefined;
      const recoveryFromClosedDate = getCycleClosedDateFallback(recoverySource);
      const daysFromRecoverySourceClose = recoverySource
        ? getCalendarDaysBetween(recoveryFromClosedDate, currentOpenDate)
        : null;
      const isRecoveryCycle =
        Boolean(recoverySource) &&
        daysFromRecoverySourceClose != null &&
        daysFromRecoverySourceClose >= 0 &&
        daysFromRecoverySourceClose <= 120;

      cycleMetaByIndex.set(index, {
        cycleKey,
        cycleNo: sortedIndex + 1,
        cycleCount,
        previousCaseId: previousCase ? getCycleCaseId(previousCase) : undefined,
        nextCaseId: nextCase ? getCycleCaseId(nextCase) : undefined,
        previousOutcomeType: getCycleOutcomeType(previousCase),
        previousClosedDate,
        daysFromPreviousClose,
        isRecoveryCycle,
        recoveryFromCaseId: isRecoveryCycle && recoverySource ? getCycleCaseId(recoverySource) : undefined,
        recoveryFromOutcome: isRecoveryCycle ? getCycleOutcomeType(recoverySource) : undefined,
        recoveryFromClosedDate: isRecoveryCycle ? recoveryFromClosedDate : undefined,
        daysFromRecoverySourceClose: isRecoveryCycle ? daysFromRecoverySourceClose : null
      });
    });
  }

  return cases.map((historyCase, index): SwingHistoryCase => ({
    ...historyCase,
    cycleMeta: cycleMetaByIndex.get(index)
  }));
}

function buildCycleSummary(cases: SwingHistoryCase[]) {
  const casesWithCycleMeta = cases.filter((historyCase) => historyCase.cycleMeta);
  const cycleKeys = new Set(casesWithCycleMeta.map((historyCase) => historyCase.cycleMeta?.cycleKey).filter(Boolean));
  const multiCycleKeys = new Set(
    casesWithCycleMeta
      .filter((historyCase) => (historyCase.cycleMeta?.cycleCount ?? 0) >= 2)
      .map((historyCase) => historyCase.cycleMeta?.cycleKey)
      .filter(Boolean)
  );
  const recoveryCases = casesWithCycleMeta.filter((historyCase) => historyCase.cycleMeta?.isRecoveryCycle === true);
  const recoverySuccessCases = recoveryCases.filter(isCycleSuccessCase);
  const recoveryDays = recoveryCases
    .map((historyCase) => historyCase.cycleMeta?.daysFromRecoverySourceClose)
    .filter((days): days is number => isFiniteNumber(days));

  return {
    cycledSymbols: cycleKeys.size,
    multiCycleSymbols: multiCycleKeys.size,
    totalCycles: casesWithCycleMeta.length,
    recoveryCycles: recoveryCases.length,
    recoverySuccessCases: recoverySuccessCases.length,
    recoverySuccessRate: recoveryCases.length ? round((recoverySuccessCases.length / recoveryCases.length) * 100) : 0,
    avgDaysToRecovery: recoveryDays.length
      ? round(recoveryDays.reduce((sum, days) => sum + days, 0) / recoveryDays.length)
      : 0
  };
}

function buildSwingHistorySummary(
  cases: SwingHistoryCase[],
  currentCandidates: Array<SwingCandidate & { sourceBucket: "execution" | "watch" }>
) {
  const totalCases = cases.length;
  const activeCases = cases.filter((item) => item.caseKind === "active" || item.status === "active").length;
  const closedCases = cases.filter((item) => item.status === "closed" || item.lifecycleStatus === "closed").length;
  const enteredCases = cases.filter((item) => item.caseKind === "entered").length;
  const noEntryCases = cases.filter((item) => (item.status === "closed" || item.lifecycleStatus === "closed") && getExecutedBuyStage(item) <= 0).length;
  const returnStatsCases = cases.filter(
    (item) => item.returnStatsEligible === true && Number.isFinite(getReturnPct(item))
  );
  const avgReturnPct = returnStatsCases.length
    ? round(returnStatsCases.reduce((sum, item) => sum + (getReturnPct(item) ?? 0), 0) / returnStatsCases.length)
    : undefined;
  const cycleSummary = cases.some((item) => item.cycleMeta) ? buildCycleSummary(cases) : undefined;

  return {
    totalCases,
    activeCases,
    closedCases,
    avgReturnPct,
    returnStatsBaseCount: returnStatsCases.length,
    ...(cycleSummary ? { cycleSummary } : {}),
    scannedExecutionCandidates: currentCandidates.filter((item) => item.sourceBucket === "execution").length,
    openedCases: cases.filter((item) => item.strategy === "swing").length,
    enteredCases,
    noEntryCases,
    targetHitCases: cases.filter((item) => item.historyOutcome?.type === "target_hit").length,
    driftProfitExitCases: cases.filter((item) => item.historyOutcome?.type === "drift_profit_exit").length,
    profitExitCases: cases.filter((item) => item.caseKind === "entered" && isProfitExitHistoryCase(item)).length,
    entryMissedUpsideCases: cases.filter((item) => item.historyOutcome?.type === "entry_missed_upside").length,
    stopBrokenCases: cases.filter((item) => item.caseKind === "entered" && isStopOutcomeHistoryCase(item)).length,
    marketShockGraceCases: cases.filter((item) => item.historyOutcome?.type === "market_shock_grace").length,
    marketShockStopCases: cases.filter((item) => item.historyOutcome?.type === "market_shock_stop").length,
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
    (isDeepZoneReboundExit(historyCase) ? getValidDateText(historyCase.maxFavorableDate) : undefined) ??
    (isTargetHitHistoryCase(historyCase) ? getTargetHitClosedDate(historyCase) : undefined) ??
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

function isActiveMarketStopGrace(historyCase: SwingHistoryCase) {
  return historyCase.marketStopGrace?.status === "active" && Boolean(historyCase.marketStopGrace.startedDate);
}

function isMarketShockGraceEligible(historyCase: SwingHistoryCase, marketShockContext: MarketShockContext | undefined) {
  if (!isStopBrokenHistoryCase(historyCase) || getExecutedBuyStage(historyCase) <= 0 || !marketShockContext?.active) {
    return false;
  }

  const stopBreakDate = getValidDateText(historyCase.dataDate);
  if (!stopBreakDate) {
    return false;
  }

  const startedDate = getValidDateText(historyCase.marketStopGrace?.startedDate);
  return !startedDate || startedDate === stopBreakDate;
}

function applyMarketStopGrace(
  historyCase: SwingHistoryCase,
  marketShockContext: MarketShockContext | undefined,
  asOfDate: string | undefined
): SwingHistoryCase {
  const stopBreakDate = getValidDateText(historyCase.dataDate);
  const existingGrace = historyCase.marketStopGrace;
  const currentAsOfDate = getValidDateText(asOfDate);

  if (!isStopBrokenHistoryCase(historyCase)) {
    if (existingGrace?.status === "active") {
      return {
        ...historyCase,
        marketStopGrace: {
          ...existingGrace,
          status: "recovered",
          lastCheckedDate: stopBreakDate ?? existingGrace.lastCheckedDate
        }
      };
    }
    return historyCase;
  }

  if (existingGrace?.status === "active" && stopBreakDate !== existingGrace.startedDate) {
    return {
      ...historyCase,
      marketStopGrace: {
        ...existingGrace,
        status: "expired",
        lastCheckedDate: stopBreakDate ?? existingGrace.lastCheckedDate
      }
    };
  }

  if (currentAsOfDate && stopBreakDate && stopBreakDate < currentAsOfDate && existingGrace?.status !== "active") {
    return historyCase;
  }

  if (isMarketShockGraceEligible(historyCase, marketShockContext)) {
    const startedDate = getValidDateText(existingGrace?.startedDate) ?? stopBreakDate;
    return {
      ...historyCase,
      marketStopGrace: {
        status: "active",
        startedDate,
        lastCheckedDate: stopBreakDate,
        shockDate: marketShockContext?.date ?? stopBreakDate,
        level: marketShockContext?.level,
        expiresAfterSessions: MARKET_SHOCK_GRACE_SESSIONS,
        reasons: marketShockContext?.reasons ?? [],
        indexChanges: marketShockContext?.indexChanges
      }
    };
  }

  if (existingGrace?.status === "active") {
    return {
      ...historyCase,
      marketStopGrace: {
        ...existingGrace,
        status: "expired",
        lastCheckedDate: stopBreakDate ?? existingGrace.lastCheckedDate
      }
    };
  }

  return historyCase;
}

function getEffectiveLifecycleStatus(
  historyCase: SwingHistoryCase,
  currentCaseKeys: Set<string>
): "current" | "closed" {
  if (isStopBrokenHistoryCase(historyCase)) {
    if (isActiveMarketStopGrace(historyCase)) {
      return "current";
    }
    return "closed";
  }
  if (isDeepZoneReboundExit(historyCase) || isDeepZoneTimeoutExit(historyCase)) {
    return "closed";
  }
  if (isTargetHitHistoryCase(historyCase)) {
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
    const scopedPoints = sliceCaseMarketWindow(points, historyCase, asOfDate);
    // Price refresh is also an execution refresh. A live case may be demoted to
    // watch and lose postEntryOutcome from the current pick payload, so replay
    // the market path against the frozen buy plan before deriving outcome.
    const shouldRefreshExecutedBuys = historyCase.entryBucket !== "watch" || hasFirstBuyAfterRecommendationStart(historyCase);
    const thirdBuyMonitor = shouldRefreshExecutedBuys
      ? buildThirdBuyMonitor(historyCase.buyPlan, scopedPoints)
      : historyCase.thirdBuyMonitor;
    const inferredExecutedBuys = shouldRefreshExecutedBuys
      ? inferExecutedBuysFromMarketPath(historyCase.buyPlan, scopedPoints)
      : [];
    const executedBuys = shouldRefreshExecutedBuys
      ? mergeExecutedBuysByStage(historyCase.executedBuys, inferredExecutedBuys)
      : (historyCase.executedBuys ?? []);
    const averageBuyPrice = getWeightedAverageBuyPrice(executedBuys);
    const effectiveAverageBuyPrice = averageBuyPrice ?? historyCase.averageBuyPrice;
    const buyPlan =
      thirdBuyMonitor?.adjustedThirdBuyPrice && historyCase.buyPlan
        ? {
            ...historyCase.buyPlan,
            originalThirdBuyPrice: historyCase.buyPlan.originalThirdBuyPrice ?? historyCase.buyPlan.thirdBuyPrice,
            thirdBuyPrice: thirdBuyMonitor.adjustedThirdBuyPrice,
            adjustedThirdBuyPrice: thirdBuyMonitor.adjustedThirdBuyPrice,
            thirdBuyAdjustment: {
              policy: "market_stability_floor_confirmed" as const,
              adjustedDate: thirdBuyMonitor.confirmedDate,
              stopBufferPct:
                isFiniteNumber(latestPoint.close) && isFiniteNumber(historyCase.buyPlan.stopLossPrice)
                  ? round(((latestPoint.close - historyCase.buyPlan.stopLossPrice) / latestPoint.close) * 100)
                  : undefined,
              supportHoldDays: 3,
              reason: thirdBuyMonitor.adjustmentReason
            }
          }
        : historyCase.buyPlan;

    return {
      ...historyCase,
      dataDate: latestPoint.date ?? historyCase.dataDate,
      latestClose: latestPoint.close,
      latestLow: marketPath.maxAdversePrice,
      buyPlan,
      thirdBuyMonitor,
      executedBuyCount: getExecutedBuyStageFromBuys(executedBuys),
      executedBuys,
      averageBuyPrice: averageBuyPrice ?? historyCase.averageBuyPrice,
      unrealizedReturnPct: calculateReturnPct(latestPoint.close, effectiveAverageBuyPrice),
      maxFavorablePrice: marketPath.maxFavorablePrice,
      maxFavorableDate: marketPath.maxFavorableDate,
      maxFavorableReturnPct: isFiniteNumber(marketPath.maxFavorablePrice)
        ? calculateReturnPct(marketPath.maxFavorablePrice, effectiveAverageBuyPrice)
        : undefined,
      maxAdversePrice: marketPath.maxAdversePrice,
      maxAdverseDate: marketPath.maxAdverseDate,
      maxAdverseReturnPct: isFiniteNumber(marketPath.maxAdversePrice)
        ? calculateReturnPct(marketPath.maxAdversePrice, effectiveAverageBuyPrice)
        : undefined
    };
  } catch {
    return historyCase;
  }
}

async function refreshCaseMarketPrices(cases: SwingHistoryCase[], asOfDate: string) {
  return Promise.all(cases.map((historyCase) => refreshCaseMarketPrice(historyCase, asOfDate)));
}

async function createMarketShockContextResolver() {
  try {
    const snapshots = await getMarketWatchSnapshots();
    const contextByDate = new Map<string, MarketShockContext | undefined>();

    return (date: string | undefined) => {
      const key = getValidDateText(date) ?? "__latest__";
      if (!contextByDate.has(key)) {
        contextByDate.set(key, buildMarketShockContext(snapshots.items, getValidDateText(date)));
      }
      return contextByDate.get(key);
    };
  } catch {
    return (_date: string | undefined) => undefined;
  }
}

function applyMarketStopGraceToCases(
  cases: SwingHistoryCase[],
  resolveMarketShockContext: (date: string | undefined) => MarketShockContext | undefined,
  asOfDate: string | undefined
) {
  return cases.map((historyCase) => applyMarketStopGrace(historyCase, resolveMarketShockContext(historyCase.dataDate), asOfDate));
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
        (item) => item.returnStatsEligible === true && Number.isFinite(getReturnPct(item))
      );
      const averageReturnPct = returnStatsCases.length
        ? round(returnStatsCases.reduce((sum, item) => sum + (getReturnPct(item) ?? 0), 0) / returnStatsCases.length)
        : undefined;

      return {
        month,
        label: getMonthLabel(month),
        closedCaseCount: monthCases.length,
        enteredCaseCount: monthCases.filter((item) => item.caseKind === "entered").length,
        noEntryCaseCount: monthCases.filter((item) => item.caseKind === "no_entry").length,
        profitExitCaseCount: monthCases.filter((item) => item.caseKind === "entered" && isProfitExitHistoryCase(item)).length,
        stopBrokenCaseCount: monthCases.filter((item) => item.caseKind === "entered" && isStopOutcomeHistoryCase(item)).length,
        marketShockStopCaseCount: monthCases.filter((item) => item.historyOutcome?.type === "market_shock_stop").length,
        returnStatsBaseCount: returnStatsCases.length,
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
  if (
    isFiniteNumber(latestClose) &&
    isFiniteNumber(stopLossPrice) &&
    latestClose <= stopLossPrice &&
    !isActiveMarketStopGrace(historyCase)
  ) {
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
  const resolveMarketShockContext = await createMarketShockContextResolver();
  const casesWithMarketStopGrace = applyMarketStopGraceToCases(cases, resolveMarketShockContext, asOfDate);

  return casesWithMarketStopGrace
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
      initialStopLossPrice: historyCase.initialStopLossPrice,
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
  const initialAlertSnapshotByKey = await readInitialSwingAlertSnapshots();
  const existingCaseByKey = new Map(
    existingCases.map((historyCase) => [getHistoryCaseKey(historyCase.profile, historyCase.symbol), historyCase])
  );
  const currentHistoryCandidates = currentCandidates.filter((candidate) =>
    shouldUpsertCurrentHistoryCase(candidate, existingCaseByKey.get(getHistoryCaseKey(candidate.profile, candidate.symbol)))
  );
  const currentCandidateByKey = new Map(
    currentHistoryCandidates.map((candidate) => [getHistoryCaseKey(candidate.profile, candidate.symbol), candidate])
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

    const nextCase = buildCurrentHistoryCase(candidate, existingCase, now, initialAlertSnapshotByKey.get(key));
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
  const currentCaseKeys = new Set(
    currentHistoryCandidates.map((candidate) => getHistoryCaseKey(candidate.profile, candidate.symbol))
  );
  const asOfDate = formatDateInSeoul(now);
  const casesWithClosedDate = cases.map((historyCase) => {
    const lifecycleStatus = currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) ? "current" : "closed";
    return enrichClosedDateFields(historyCase, lifecycleStatus, asOfDate);
  });
  const casesWithLatestMarketPrice = await refreshCaseMarketPrices(casesWithClosedDate, asOfDate);
  const resolveMarketShockContext = await createMarketShockContextResolver();
  const casesWithMarketStopGrace = applyMarketStopGraceToCases(casesWithLatestMarketPrice, resolveMarketShockContext, asOfDate);
  const casesWithOutcome = casesWithMarketStopGrace.map((historyCase) => {
    const lifecycleStatus = getEffectiveLifecycleStatus(historyCase, currentCaseKeys);
    const caseWithLifecycle = enrichClosedDateFields(historyCase, lifecycleStatus, asOfDate);

    return {
      ...caseWithLifecycle,
      historyOutcome: deriveHistoryOutcome(caseWithLifecycle, lifecycleStatus)
    };
  });
  const casesWithDiagnostics = casesWithOutcome.map((historyCase) =>
    enrichHistoryCaseClassification(
      attachHistoryDiagnostics(historyCase, currentCandidateByKey.get(getHistoryCaseKey(historyCase.profile, historyCase.symbol)))
    )
  );
  const currentEnteredRecommendationCount = casesWithDiagnostics.filter(
    (historyCase) => currentCaseKeys.has(getHistoryCaseKey(historyCase.profile, historyCase.symbol)) && getExecutedBuyStage(historyCase) > 0
  ).length;
  const closedCases = casesWithDiagnostics.filter((historyCase) => historyCase.status === "closed");
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
    summary: buildSwingHistorySummary(casesWithDiagnostics, currentHistoryCandidates),
    closedMonths: buildClosedMonthSummaries(closedCases),
    cases: casesWithDiagnostics
  };

  await mkdir(path.dirname(swingHistoryPath), { recursive: true });
  await writeFile(swingHistoryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return {
    asOfDate,
    caseCount: cases.length,
    upsertedCaseCount,
    currentRecommendationCount: currentHistoryCandidates.length,
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
  const currentExecutionCandidates = currentCandidates.filter((candidate) => candidate.sourceBucket === "execution");
  const existingCaseByKey = new Map(
    cases.map((historyCase) => [getHistoryCaseKey(historyCase.profile, historyCase.symbol), historyCase])
  );
  const currentHistoryCandidates = currentCandidates.filter((candidate) =>
    shouldUpsertCurrentHistoryCase(candidate, existingCaseByKey.get(getHistoryCaseKey(candidate.profile, candidate.symbol)))
  );
  const currentByProfileSymbol = new Map(
    currentHistoryCandidates.map((candidate) => [getCandidateKey(candidate.profile, candidate.symbol), candidate])
  );
  const currentBySymbol = new Map(currentHistoryCandidates.map((candidate) => [candidate.symbol, candidate]));
  const currentCaseKeys = new Set(
    currentHistoryCandidates.map((candidate) => getHistoryCaseKey(candidate.profile, candidate.symbol))
  );
  const resolveMarketShockContext = await createMarketShockContextResolver();
  const casesWithMarketStopGrace = applyMarketStopGraceToCases(cases, resolveMarketShockContext, payload.asOfDate as string | undefined);

  const enrichedCases = casesWithMarketStopGrace.map((historyCase) => {
    const currentRecommendation =
      currentByProfileSymbol.get(getCandidateKey(historyCase.profile, historyCase.symbol)) ??
      (historyCase.profile ? undefined : currentBySymbol.get(historyCase.symbol));
    const lifecycleStatus = getEffectiveLifecycleStatus(historyCase, currentCaseKeys);
    const caseWithClosedDate = enrichClosedDateFields(historyCase, lifecycleStatus, payload.asOfDate as string | undefined);

    const caseWithOutcome = {
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
    return enrichHistoryCaseClassification(attachHistoryDiagnostics(caseWithOutcome, currentRecommendation));
  });
  const cycleEnrichedCases = attachCycleMetaToCases(enrichedCases);

  const historyCaseByProfileSymbol = new Map(
    cycleEnrichedCases.map((historyCase) => [getCandidateKey(historyCase.profile as string | undefined, historyCase.symbol), historyCase])
  );
  const legacyHistoryCaseBySymbol = new Map(
    cycleEnrichedCases
      .filter((historyCase) => !historyCase.profile)
      .map((historyCase) => [historyCase.symbol, historyCase])
  );
  const enrichedCurrentCandidates = currentHistoryCandidates.map((candidate) => {
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

  const currentCaseCount = cycleEnrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "current").length;
  const closedCases = cycleEnrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "closed");
  const closedCaseCount = closedCases.length;
  const normalizedSummary = buildSwingHistorySummary(cycleEnrichedCases, currentHistoryCandidates);

  return {
    ...payload,
    cases: cycleEnrichedCases,
    currentCandidates: enrichedCurrentCandidates,
    currentEnteredCandidates: enteredCurrentCandidates,
    pendingEntryCandidates,
    closedCases,
    closedMonths: buildClosedMonthSummaries(closedCases),
    summary: {
      ...(payload.summary ?? {}),
      ...normalizedSummary,
      currentRecommendationCount: currentHistoryCandidates.length,
      currentEnteredRecommendationCount: enteredCurrentCandidates.length,
      pendingEntryCandidateCount: pendingEntryCandidates.length,
      currentExecutionCount: currentExecutionCandidates.length,
      currentWatchCount: currentHistoryCandidates.filter((candidate) => candidate.sourceBucket === "watch").length,
      currentCaseCount,
      closedCaseCount
    }
  };
}
