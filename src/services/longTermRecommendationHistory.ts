import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { withJsonFileMutation, writeJsonFileAtomic } from "../lib/jsonFile.js";
import type { LongTermScanCandidate } from "../types.js";
import type { ServerLongTermPick } from "./serverLongTermPicks.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");

export const longTermRecommendationHistoryPath = path.join(
  projectRoot,
  "data",
  "recommendation-history",
  "long-term-history.json"
);

export const LONG_TERM_HISTORY_SCHEMA_VERSION = 2 as const;
export const LONG_TERM_HISTORY_POLICY_VERSION = "long-term-universe-v2";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const HISTORY_FLOAT_TOLERANCE = 0.011;

export type LongTermHistoryBucket = "watch" | "accumulate" | "buy";
export type LongTermHistoryLifecycleStatus = "current" | "stale" | "closed";
export type LongTermScanCompleteness = "unknown" | "complete" | "partial";
export type LongTermHistoryOutcomeType =
  | "unresolved"
  | "edge_realized"
  | "thesis_broken"
  | "time_expired"
  | "administrative_close"
  | "manual_close"
  | "data_unavailable";
export type LongTermClosedOutcomeType = Exclude<LongTermHistoryOutcomeType, "unresolved">;

export type LongTermHistoryScanScope =
  | {
      mode: "full_universe";
    }
  | {
      mode: "symbols";
      symbols: string[];
    };

export type LongTermHistoryEvent = {
  id: string;
  type:
    | "recommendation_started"
    | "bucket_changed"
    | "observation"
    | "stale_marked"
    | "reobserved"
    | "plan_revised"
    | "tranche_filled"
    | "review_due"
    | "reviewed"
    | "extended"
    | "closed"
    | "data_quality_warning";
  occurredAt: string;
  asOfDate: string;
  scanId: string;
  bucket?: LongTermHistoryBucket;
  fromBucket?: LongTermHistoryBucket;
  toBucket?: LongTermHistoryBucket;
  referencePrice?: number;
  totalScore?: number;
  reason: string;
  policyVersion: string;
  provenance: "live_scan" | "migrated" | "manual" | "policy";
  inferred: boolean;
  operationDigest?: string;
};

export type LongTermDecisionSnapshot = LongTermScanCandidate & {
  capturedAt: string;
  asOfDate: string;
  referencePrice: number;
  priceSource: "scan_close";
  bucket: LongTermHistoryBucket;
  policyVersion: string;
};

export type LongTermRecommendationHistoryCase = {
  id: string;
  strategy: "longTerm";
  cycleNo: number;
  symbol: string;
  name: string;
  sourceKey?: string;
  openedAt: string;
  openedDate: string;
  lastObservedAt: string;
  lastObservedDate: string;
  candidateAnchorDate?: string;
  bucketEnteredDate?: string;
  staleSinceDate?: string;
  consecutiveMissCount: number;
  closedAt?: string;
  closedDate?: string;
  status: LongTermHistoryLifecycleStatus;
  entryBucket: "accumulate" | "buy";
  lastObservedBucket: LongTermHistoryBucket;
  initialReferencePrice: number;
  lastObservedPrice: number;
  events: LongTermHistoryEvent[];
  modelPosition: {
    policyStatus: "pending" | "configured";
    budgetMode: "unconfigured" | "normalized" | "account_linked";
    caseBudget: number | null;
    allocationCapPct: number | null;
    availableNow: number | null;
    filledAmount: number;
    tranches: Array<{
      stage: number;
      status: "planned" | "filled" | "cancelled";
      plannedPrice?: number;
      filledPrice?: number;
      amount?: number;
      filledAt?: string;
    }>;
  };
  returnMetrics: {
    signalBasisPrice: number;
    latestPrice: number;
    latestSignalReturnPct: number;
    maxObservedPrice: number;
    minObservedPrice: number;
    maxObservedReturnPct: number;
    minObservedReturnPct: number;
    evaluatedAt: string;
  };
  historyOutcome: {
    type: LongTermHistoryOutcomeType;
    category: "active" | "profit" | "loss" | "neutral" | "excluded";
    evaluatedAt: string;
    reason: string;
  };
  dataQuality: {
    scanId: string;
    scanCompleteness: LongTermScanCompleteness;
    priceLoaded: boolean;
    financialsLoaded: boolean;
    reconstructed: boolean;
    reconstructionSources: string[];
    warnings: string[];
  };
  tracking: {
    lastProcessedScanId: string;
    lastProcessedAsOfDate: string;
    observedInLastScan: boolean;
    scanCompleteness: LongTermScanCompleteness;
  };
  closeReview: {
    status: "not_configured" | "not_triggered" | "pending" | "confirmed";
    policyVersion?: string;
    reasons: string[];
  };
  strategyData: {
    candidateType: LongTermScanCandidate["candidateType"];
    initialSnapshot: LongTermDecisionSnapshot;
    latestSnapshot: LongTermDecisionSnapshot;
    planRevisions: Array<{
      revisedAt: string;
      asOfDate: string;
      reason: string;
      previous: Record<string, unknown>;
      next: Record<string, unknown>;
    }>;
    reviewSchedule: {
      status: "not_configured" | "scheduled" | "due";
      nextReviewDate: string | null;
    };
    invalidation: {
      status: "not_triggered" | "review_required" | "confirmed";
      reasons: string[];
    };
  };
};

export type LongTermAppliedScan = {
  scanId: string;
  digest: string;
  asOfDate: string;
  capturedAt: string;
  universeSize: number;
  candidateCount: number;
  actionableCount: number;
  scanCompleteness: LongTermScanCompleteness;
  scope: LongTermHistoryScanScope;
};

export type LongTermRecommendationHistoryPayload = {
  schemaVersion: typeof LONG_TERM_HISTORY_SCHEMA_VERSION;
  strategy: "longTerm";
  generatedAt: string;
  asOfDate: string | null;
  scope: {
    source: "scanLongTermUniverse";
    sourceFiles: ["data/server-long-term-picks.json"];
    includedStartBuckets: ["accumulate", "buy"];
    watchUpdatesExistingCases: true;
    removalClosesCase: false;
  };
  commonSummary: {
    caseCount: number;
    openCaseCount: number;
    currentCaseCount: number;
    staleCaseCount: number;
    closedCaseCount: number;
  };
  strategySummary: {
    currentBuyCount: number;
    currentAccumulateCount: number;
    currentWatchCount: number;
    eventCount: number;
    lastScanUniverseSize: number;
    lastScanCandidateCount: number;
    lastScanActionableCount: number;
    lastScanCompleteness: LongTermScanCompleteness;
  };
  appliedScans: LongTermAppliedScan[];
  cases: LongTermRecommendationHistoryCase[];
};

export type LongTermRecommendationHistoryUpdateResult = {
  status: "applied" | "deduplicated";
  deduplicated: boolean;
  caseCount: number;
  currentCaseCount: number;
  staleCaseCount: number;
  startedCaseCount: number;
  updatedCaseCount: number;
  skippedWatchCount: number;
  appendedEventCount: number;
  asOfDate: string;
  scanId: string;
  digest: string;
  scanStartedCases: Array<{
    symbol: string;
    cycleNo: number;
  }>;
  currentPickDateOverrides: Array<{
    symbol: string;
    anchorDate: string;
    bucketEnteredDate?: string;
  }>;
};

export type LongTermHistoryUpdateInput = {
  asOfDate: string;
  universeSize: number;
  candidates: LongTermScanCandidate[];
  currentPicks?: ServerLongTermPick[];
  capturedAt?: string;
  scanId?: string;
  scanCompleteness?: LongTermScanCompleteness;
  scope?: LongTermHistoryScanScope;
};

export type CloseLongTermRecommendationHistoryInput = {
  caseId: string;
  closedDate: string;
  closedAt?: string;
  closeId?: string;
  outcomeType: LongTermClosedOutcomeType;
  category: "profit" | "loss" | "neutral" | "excluded";
  reason: string;
  policyVersion: string;
  provenance: "manual" | "policy";
};

type LongTermHistoryStorageOptions = {
  filePath?: string;
};

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDateSchema = z.string().refine(isValidIsoDate, "Invalid ISO date.");
const isoDateTimeSchema = z.string().regex(ISO_DATE_TIME_PATTERN).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Invalid ISO date-time."
);
const finiteNumberSchema = z.number().finite();
const positiveNumberSchema = finiteNumberSchema.positive();
const bucketSchema = z.enum(["watch", "accumulate", "buy"]);
const lifecycleStatusSchema = z.enum(["current", "stale", "closed"]);
const scanCompletenessSchema = z.enum(["unknown", "complete", "partial"]);
const candidateTypeSchema = z.enum(["leader", "quality", "deep_value", "turnaround"]);
const candidateGroupSchema = z.enum(["buy candidate", "accumulate candidate", "watch candidate"]);
const candidateLabelSchema = z.enum([
  "leader correction watch",
  "deep value review",
  "base-forming candidate",
  "contrarian accumulation candidate",
  "needs more stabilization"
]);

const scanScopeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("full_universe")
  }),
  z.object({
    mode: z.literal("symbols"),
    symbols: z.array(z.string().min(1))
  })
]);

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "recommendation_started",
    "bucket_changed",
    "observation",
    "stale_marked",
    "reobserved",
    "plan_revised",
    "tranche_filled",
    "review_due",
    "reviewed",
    "extended",
    "closed",
    "data_quality_warning"
  ]),
  occurredAt: isoDateTimeSchema,
  asOfDate: isoDateSchema,
  scanId: z.string().min(1),
  bucket: bucketSchema.optional(),
  fromBucket: bucketSchema.optional(),
  toBucket: bucketSchema.optional(),
  referencePrice: positiveNumberSchema.optional(),
  totalScore: finiteNumberSchema.optional(),
  reason: z.string().min(1),
  policyVersion: z.string().min(1),
  provenance: z.enum(["live_scan", "migrated", "manual", "policy"]),
  inferred: z.boolean(),
  operationDigest: z.string().regex(/^[a-f0-9]{64}$/).optional()
});

const decisionSnapshotSchema = z
  .object({
    symbol: z.string().min(1),
    name: z.string().min(1),
    price: positiveNumberSchema,
    scores: z
      .object({
        baseScore: finiteNumberSchema,
        bonusScore: finiteNumberSchema,
        rawScore: finiteNumberSchema,
        totalScore: finiteNumberSchema,
        leaderScore: finiteNumberSchema,
        correctionScore: finiteNumberSchema,
        trendScore: finiteNumberSchema,
        liquidityScore: finiteNumberSchema,
        stabilizationScore: finiteNumberSchema,
        financialScore: finiteNumberSchema,
        volumeProfileScore: finiteNumberSchema.optional(),
        higherTimeframeScore: finiteNumberSchema.optional()
      })
      .passthrough(),
    structure: z
      .object({
        ma60: finiteNumberSchema.optional(),
        ma120: finiteNumberSchema.optional(),
        ma240: finiteNumberSchema.optional(),
        ma120Slope: finiteNumberSchema.optional(),
        ma240Slope: finiteNumberSchema.optional(),
        priceVsMA120Pct: finiteNumberSchema.optional(),
        priceVsMA240Pct: finiteNumberSchema.optional()
      })
      .passthrough(),
    baseStructure: z
      .object({
        recentLow: finiteNumberSchema.optional(),
        distanceFromLowPct: finiteNumberSchema.optional(),
        higherLowCount: z.number().int().nonnegative(),
        higherLowQualityScore: finiteNumberSchema.optional(),
        daysSinceLastLowBreak: z.number().int().nonnegative(),
        daysSincePeak: z.number().int().nonnegative().optional(),
        baseDurationDays: z.number().int().nonnegative(),
        timeSinceLastMajorLow: z.number().int().nonnegative(),
        isStabilizing: z.boolean()
      })
      .passthrough(),
    liquidity: z
      .object({
        avgTurnover20: finiteNumberSchema.optional(),
        avgTurnover60: finiteNumberSchema.optional(),
        volumeConsistency: finiteNumberSchema.optional(),
        liquidityStability: finiteNumberSchema.optional(),
        accumulationSignal: finiteNumberSchema.optional()
      })
      .passthrough(),
    candidateType: candidateTypeSchema,
    candidateGroup: candidateGroupSchema,
    label: candidateLabelSchema,
    reasonSummary: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    failureReasons: z.array(z.string()),
    tags: z.array(z.string()),
    capturedAt: isoDateTimeSchema,
    asOfDate: isoDateSchema,
    referencePrice: positiveNumberSchema,
    priceSource: z.literal("scan_close"),
    bucket: bucketSchema,
    policyVersion: z.string().min(1)
  })
  .passthrough();

const scanCandidateSchema = decisionSnapshotSchema.omit({
  capturedAt: true,
  asOfDate: true,
  referencePrice: true,
  priceSource: true,
  bucket: true,
  policyVersion: true
});

const historyCaseSchema = z.object({
  id: z.string().min(1),
  strategy: z.literal("longTerm"),
  cycleNo: z.number().int().positive(),
  symbol: z.string().min(1),
  name: z.string().min(1),
  sourceKey: z.string().min(1).optional(),
  openedAt: isoDateTimeSchema,
  openedDate: isoDateSchema,
  lastObservedAt: isoDateTimeSchema,
  lastObservedDate: isoDateSchema,
  candidateAnchorDate: isoDateSchema.optional(),
  bucketEnteredDate: isoDateSchema.optional(),
  staleSinceDate: isoDateSchema.optional(),
  consecutiveMissCount: z.number().int().nonnegative(),
  closedAt: isoDateTimeSchema.optional(),
  closedDate: isoDateSchema.optional(),
  status: lifecycleStatusSchema,
  entryBucket: z.enum(["accumulate", "buy"]),
  lastObservedBucket: bucketSchema,
  initialReferencePrice: positiveNumberSchema,
  lastObservedPrice: positiveNumberSchema,
  events: z.array(eventSchema).min(1),
  modelPosition: z.object({
    policyStatus: z.enum(["pending", "configured"]),
    budgetMode: z.enum(["unconfigured", "normalized", "account_linked"]),
    caseBudget: finiteNumberSchema.nonnegative().nullable(),
    allocationCapPct: finiteNumberSchema.min(0).max(100).nullable(),
    availableNow: finiteNumberSchema.nonnegative().nullable(),
    filledAmount: finiteNumberSchema.nonnegative(),
    tranches: z.array(
      z.object({
        stage: z.number().int().positive(),
        status: z.enum(["planned", "filled", "cancelled"]),
        plannedPrice: positiveNumberSchema.optional(),
        filledPrice: positiveNumberSchema.optional(),
        amount: finiteNumberSchema.nonnegative().optional(),
        filledAt: isoDateTimeSchema.optional()
      })
    )
  }),
  returnMetrics: z.object({
    signalBasisPrice: positiveNumberSchema,
    latestPrice: positiveNumberSchema,
    latestSignalReturnPct: finiteNumberSchema,
    maxObservedPrice: positiveNumberSchema,
    minObservedPrice: positiveNumberSchema,
    maxObservedReturnPct: finiteNumberSchema,
    minObservedReturnPct: finiteNumberSchema,
    evaluatedAt: isoDateTimeSchema
  }),
  historyOutcome: z.object({
    type: z.enum([
      "unresolved",
      "edge_realized",
      "thesis_broken",
      "time_expired",
      "administrative_close",
      "manual_close",
      "data_unavailable"
    ]),
    category: z.enum(["active", "profit", "loss", "neutral", "excluded"]),
    evaluatedAt: isoDateTimeSchema,
    reason: z.string().min(1)
  }),
  dataQuality: z.object({
    scanId: z.string().min(1),
    scanCompleteness: scanCompletenessSchema,
    priceLoaded: z.boolean(),
    financialsLoaded: z.boolean(),
    reconstructed: z.boolean(),
    reconstructionSources: z.array(z.string()),
    warnings: z.array(z.string())
  }),
  tracking: z.object({
    lastProcessedScanId: z.string().min(1),
    lastProcessedAsOfDate: isoDateSchema,
    observedInLastScan: z.boolean(),
    scanCompleteness: scanCompletenessSchema
  }),
  closeReview: z.object({
    status: z.enum(["not_configured", "not_triggered", "pending", "confirmed"]),
    policyVersion: z.string().min(1).optional(),
    reasons: z.array(z.string())
  }),
  strategyData: z.object({
    candidateType: candidateTypeSchema,
    initialSnapshot: decisionSnapshotSchema,
    latestSnapshot: decisionSnapshotSchema,
    planRevisions: z.array(
      z.object({
        revisedAt: isoDateTimeSchema,
        asOfDate: isoDateSchema,
        reason: z.string().min(1),
        previous: z.record(z.string(), z.unknown()),
        next: z.record(z.string(), z.unknown())
      })
    ),
    reviewSchedule: z.object({
      status: z.enum(["not_configured", "scheduled", "due"]),
      nextReviewDate: isoDateSchema.nullable()
    }),
    invalidation: z.object({
      status: z.enum(["not_triggered", "review_required", "confirmed"]),
      reasons: z.array(z.string())
    })
  })
});

const appliedScanSchema = z.object({
  scanId: z.string().min(1),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  asOfDate: isoDateSchema,
  capturedAt: isoDateTimeSchema,
  universeSize: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  actionableCount: z.number().int().nonnegative(),
  scanCompleteness: scanCompletenessSchema,
  scope: scanScopeSchema
});

const payloadSchema = z.object({
  schemaVersion: z.literal(LONG_TERM_HISTORY_SCHEMA_VERSION),
  strategy: z.literal("longTerm"),
  generatedAt: isoDateTimeSchema,
  asOfDate: isoDateSchema.nullable(),
  scope: z.object({
    source: z.literal("scanLongTermUniverse"),
    sourceFiles: z.tuple([z.literal("data/server-long-term-picks.json")]),
    includedStartBuckets: z.tuple([z.literal("accumulate"), z.literal("buy")]),
    watchUpdatesExistingCases: z.literal(true),
    removalClosesCase: z.literal(false)
  }),
  commonSummary: z.object({
    caseCount: z.number().int().nonnegative(),
    openCaseCount: z.number().int().nonnegative(),
    currentCaseCount: z.number().int().nonnegative(),
    staleCaseCount: z.number().int().nonnegative(),
    closedCaseCount: z.number().int().nonnegative()
  }),
  strategySummary: z.object({
    currentBuyCount: z.number().int().nonnegative(),
    currentAccumulateCount: z.number().int().nonnegative(),
    currentWatchCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    lastScanUniverseSize: z.number().int().nonnegative(),
    lastScanCandidateCount: z.number().int().nonnegative(),
    lastScanActionableCount: z.number().int().nonnegative(),
    lastScanCompleteness: scanCompletenessSchema
  }),
  appliedScans: z.array(appliedScanSchema),
  cases: z.array(historyCaseSchema)
});

function isNodeErrorWithCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

function calculateReturnPct(price: number, basis: number) {
  if (!Number.isFinite(price) || !Number.isFinite(basis) || basis <= 0) {
    return 0;
  }
  return Number((((price - basis) / basis) * 100).toFixed(2));
}

function areNumbersClose(left: number, right: number) {
  return Math.abs(left - right) <= HISTORY_FLOAT_TOLERANCE;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function normalizeScope(scope: LongTermHistoryScanScope | undefined): LongTermHistoryScanScope {
  if (!scope || scope.mode === "full_universe") {
    return {
      mode: "full_universe"
    };
  }

  return {
    mode: "symbols",
    symbols: [...new Set(scope.symbols.map(normalizeSymbol).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, "en")
    )
  };
}

function assertJsonSafeNumbers(value: unknown, location: string, seen = new WeakSet<object>()) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number in ${location}.`);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    throw new Error(`Circular value in ${location}.`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonSafeNumbers(entry, `${location}[${index}]`, seen));
  } else {
    for (const [key, entry] of Object.entries(value)) {
      assertJsonSafeNumbers(entry, `${location}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function normalizeCandidates(candidates: LongTermScanCandidate[]) {
  const candidateBySymbol = new Map<string, LongTermScanCandidate>();

  for (const candidate of candidates) {
    const symbol = normalizeSymbol(candidate.symbol);
    const name = candidate.name.trim();
    assertJsonSafeNumbers(candidate, `long-term candidate ${symbol || candidate.symbol}`);
    const validated = scanCandidateSchema.safeParse({
      ...candidate,
      symbol,
      name
    });
    if (!validated.success) {
      throw new Error(`Invalid long-term scan candidate: ${candidate.symbol}`);
    }
    if (candidateBySymbol.has(symbol)) {
      throw new Error(`Duplicate long-term scan candidate symbol: ${symbol}`);
    }
    candidateBySymbol.set(symbol, {
      ...(validated.data as LongTermScanCandidate),
      symbol,
      name
    });
  }

  return [...candidateBySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol, "en"));
}

function normalizeCurrentPicks(currentPicks: ServerLongTermPick[] | undefined) {
  const pickBySymbol = new Map<string, ServerLongTermPick>();
  for (const pick of currentPicks ?? []) {
    const symbol = normalizeSymbol(pick.symbol);
    if (
      !symbol ||
      !pick.key?.trim() ||
      !isValidIsoDate(pick.anchorDate) ||
      (pick.latestMentionDate !== undefined && !isValidIsoDate(pick.latestMentionDate)) ||
      (pick.bucketEnteredDate !== undefined && !isValidIsoDate(pick.bucketEnteredDate))
    ) {
      throw new Error(`Invalid current long-term pick: ${pick.symbol}`);
    }
    if (pickBySymbol.has(symbol)) {
      throw new Error(`Duplicate current long-term pick symbol: ${symbol}`);
    }
    pickBySymbol.set(symbol, {
      ...pick,
      symbol
    });
  }

  return [...pickBySymbol.values()].sort((left, right) =>
    left.symbol.localeCompare(right.symbol, "en")
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function createLongTermHistoryScanIdentity(input: {
  asOfDate: string;
  universeSize: number;
  candidates: LongTermScanCandidate[];
  currentPicks?: ServerLongTermPick[];
  scanCompleteness?: LongTermScanCompleteness;
  scope?: LongTermHistoryScanScope;
  scanId?: string;
}) {
  const candidates = normalizeCandidates(input.candidates);
  const currentPicks = normalizeCurrentPicks(input.currentPicks);
  const scanCompleteness = input.scanCompleteness ?? "unknown";
  const scope = normalizeScope(input.scope);
  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          asOfDate: input.asOfDate,
          universeSize: input.universeSize,
          scanCompleteness,
          scope,
          candidates,
          currentPicks: currentPicks.map((pick) => ({
            symbol: pick.symbol,
            key: pick.key,
            anchorDate: pick.anchorDate,
            latestMentionDate: pick.latestMentionDate,
            bucketEnteredDate: pick.bucketEnteredDate,
            longTermBucket: pick.longTermBucket,
            source: pick.source
          }))
        })
      )
    )
    .digest("hex");

  return {
    candidates,
    currentPicks,
    scanCompleteness,
    scope,
    digest,
    scanId: input.scanId ?? `longTerm:${input.asOfDate}:${digest.slice(0, 24)}`,
    explicitScanId: input.scanId !== undefined
  };
}

function createEmptyPayload(generatedAt = new Date().toISOString()): LongTermRecommendationHistoryPayload {
  return {
    schemaVersion: LONG_TERM_HISTORY_SCHEMA_VERSION,
    strategy: "longTerm",
    generatedAt,
    asOfDate: null,
    scope: {
      source: "scanLongTermUniverse",
      sourceFiles: ["data/server-long-term-picks.json"],
      includedStartBuckets: ["accumulate", "buy"],
      watchUpdatesExistingCases: true,
      removalClosesCase: false
    },
    commonSummary: {
      caseCount: 0,
      openCaseCount: 0,
      currentCaseCount: 0,
      staleCaseCount: 0,
      closedCaseCount: 0
    },
    strategySummary: {
      currentBuyCount: 0,
      currentAccumulateCount: 0,
      currentWatchCount: 0,
      eventCount: 0,
      lastScanUniverseSize: 0,
      lastScanCandidateCount: 0,
      lastScanActionableCount: 0,
      lastScanCompleteness: "unknown"
    },
    appliedScans: [],
    cases: []
  };
}

function summarizeCases(cases: LongTermRecommendationHistoryCase[]) {
  const currentCases = cases.filter((historyCase) => historyCase.status === "current");
  const staleCases = cases.filter((historyCase) => historyCase.status === "stale");
  const closedCases = cases.filter((historyCase) => historyCase.status === "closed");
  return {
    commonSummary: {
      caseCount: cases.length,
      openCaseCount: currentCases.length + staleCases.length,
      currentCaseCount: currentCases.length,
      staleCaseCount: staleCases.length,
      closedCaseCount: closedCases.length
    },
    strategyCounts: {
      currentBuyCount: currentCases.filter((historyCase) => historyCase.lastObservedBucket === "buy").length,
      currentAccumulateCount: currentCases.filter(
        (historyCase) => historyCase.lastObservedBucket === "accumulate"
      ).length,
      currentWatchCount: currentCases.filter((historyCase) => historyCase.lastObservedBucket === "watch").length,
      eventCount: cases.reduce((sum, historyCase) => sum + historyCase.events.length, 0)
    }
  };
}

function assertPayloadSemantics(payload: LongTermRecommendationHistoryPayload) {
  const caseIds = new Set<string>();
  const cycleKeys = new Set<string>();
  const eventIds = new Set<string>();
  const openSymbols = new Set<string>();
  const appliedScanIds = new Map<string, LongTermAppliedScan>();
  let previousAppliedScan: LongTermAppliedScan | undefined;

  for (const appliedScan of payload.appliedScans) {
    const previousScanWithId = appliedScanIds.get(appliedScan.scanId);
    if (previousScanWithId && previousScanWithId.digest !== appliedScan.digest) {
      throw new Error(`Conflicting applied scan ID: ${appliedScan.scanId}`);
    }
    if (previousScanWithId) {
      throw new Error(`Duplicate applied scan ID: ${appliedScan.scanId}`);
    }
    if (
      appliedScan.actionableCount > appliedScan.candidateCount ||
      appliedScan.candidateCount > appliedScan.universeSize
    ) {
      throw new Error(`Invalid applied long-term scan counts: ${appliedScan.scanId}`);
    }
    appliedScanIds.set(appliedScan.scanId, appliedScan);
    if (
      previousAppliedScan &&
      (appliedScan.asOfDate < previousAppliedScan.asOfDate ||
        Date.parse(appliedScan.capturedAt) <= Date.parse(previousAppliedScan.capturedAt))
    ) {
      throw new Error(`Out-of-order applied long-term scan: ${appliedScan.scanId}`);
    }
    previousAppliedScan = appliedScan;
  }

  for (const historyCase of payload.cases) {
    if (caseIds.has(historyCase.id)) {
      throw new Error(`Duplicate long-term history case ID: ${historyCase.id}`);
    }
    caseIds.add(historyCase.id);
    if (historyCase.id !== `longTerm:${historyCase.symbol}:${historyCase.cycleNo}`) {
      throw new Error(`Long-term history case identity mismatch: ${historyCase.id}`);
    }

    const cycleKey = `${historyCase.symbol}:${historyCase.cycleNo}`;
    if (cycleKeys.has(cycleKey)) {
      throw new Error(`Duplicate long-term history cycle: ${cycleKey}`);
    }
    cycleKeys.add(cycleKey);

    if (historyCase.status !== "closed") {
      if (openSymbols.has(historyCase.symbol)) {
        throw new Error(`Multiple open long-term history cases for symbol: ${historyCase.symbol}`);
      }
      openSymbols.add(historyCase.symbol);
    }

    if (historyCase.events[0]?.type !== "recommendation_started") {
      throw new Error(`Long-term history case must start with recommendation_started: ${historyCase.id}`);
    }
    let previousEvent: LongTermHistoryEvent | undefined;
    for (const event of historyCase.events) {
      if (eventIds.has(event.id)) {
        throw new Error(`Duplicate long-term history event ID: ${event.id}`);
      }
      eventIds.add(event.id);
      if (
        previousEvent &&
        (Date.parse(event.occurredAt) < Date.parse(previousEvent.occurredAt) ||
          event.asOfDate < previousEvent.asOfDate)
      ) {
        throw new Error(`Out-of-order long-term history event: ${event.id}`);
      }
      if (event.provenance === "live_scan" && !appliedScanIds.has(event.scanId)) {
        throw new Error(`Long-term history event references unknown scan: ${event.id}`);
      }
      const eventScan = appliedScanIds.get(event.scanId);
      if (
        event.provenance === "live_scan" &&
        eventScan &&
        (event.asOfDate !== eventScan.asOfDate || event.occurredAt !== eventScan.capturedAt)
      ) {
        throw new Error(`Long-term history event scan mismatch: ${event.id}`);
      }
      if (Date.parse(event.occurredAt) > Date.parse(payload.generatedAt)) {
        throw new Error(`Long-term history event is newer than payload: ${event.id}`);
      }
      previousEvent = event;
    }

    const initialSnapshot = historyCase.strategyData.initialSnapshot;
    const latestSnapshot = historyCase.strategyData.latestSnapshot;
    if (
      initialSnapshot.symbol !== historyCase.symbol ||
      initialSnapshot.bucket !== historyCase.entryBucket ||
      !areNumbersClose(initialSnapshot.referencePrice, historyCase.initialReferencePrice) ||
      initialSnapshot.capturedAt !== historyCase.openedAt ||
      initialSnapshot.asOfDate !== historyCase.openedDate
    ) {
      throw new Error(`Initial snapshot mismatch: ${historyCase.id}`);
    }
    if (
      latestSnapshot.symbol !== historyCase.symbol ||
      latestSnapshot.bucket !== historyCase.lastObservedBucket ||
      !areNumbersClose(latestSnapshot.referencePrice, historyCase.lastObservedPrice) ||
      latestSnapshot.capturedAt !== historyCase.lastObservedAt ||
      latestSnapshot.asOfDate !== historyCase.lastObservedDate
    ) {
      throw new Error(`Latest snapshot mismatch: ${historyCase.id}`);
    }
    const trackingScan = appliedScanIds.get(historyCase.tracking.lastProcessedScanId);
    const dataQualityScan = appliedScanIds.get(historyCase.dataQuality.scanId);
    if (
      historyCase.openedDate > historyCase.lastObservedDate ||
      Date.parse(historyCase.openedAt) > Date.parse(historyCase.lastObservedAt) ||
      historyCase.lastObservedDate > historyCase.tracking.lastProcessedAsOfDate ||
      !trackingScan ||
      historyCase.tracking.lastProcessedAsOfDate !== trackingScan.asOfDate ||
      historyCase.tracking.scanCompleteness !== trackingScan.scanCompleteness ||
      !dataQualityScan ||
      historyCase.dataQuality.scanCompleteness !== dataQualityScan.scanCompleteness
    ) {
      throw new Error(`Invalid long-term history chronology: ${historyCase.id}`);
    }

    const expectedLatestReturn = calculateReturnPct(
      historyCase.lastObservedPrice,
      historyCase.initialReferencePrice
    );
    if (
      !areNumbersClose(historyCase.returnMetrics.signalBasisPrice, historyCase.initialReferencePrice) ||
      !areNumbersClose(historyCase.returnMetrics.latestPrice, historyCase.lastObservedPrice) ||
      !areNumbersClose(historyCase.returnMetrics.latestSignalReturnPct, expectedLatestReturn) ||
      !areNumbersClose(
        historyCase.returnMetrics.maxObservedReturnPct,
        calculateReturnPct(historyCase.returnMetrics.maxObservedPrice, historyCase.initialReferencePrice)
      ) ||
      !areNumbersClose(
        historyCase.returnMetrics.minObservedReturnPct,
        calculateReturnPct(historyCase.returnMetrics.minObservedPrice, historyCase.initialReferencePrice)
      ) ||
      historyCase.returnMetrics.maxObservedPrice <
        Math.max(historyCase.initialReferencePrice, historyCase.lastObservedPrice) ||
      historyCase.returnMetrics.minObservedPrice >
        Math.min(historyCase.initialReferencePrice, historyCase.lastObservedPrice) ||
      historyCase.returnMetrics.evaluatedAt !== historyCase.lastObservedAt
    ) {
      throw new Error(`Return metric mismatch: ${historyCase.id}`);
    }

    if (historyCase.status === "current") {
      if (
        historyCase.staleSinceDate ||
        historyCase.consecutiveMissCount !== 0 ||
        !historyCase.tracking.observedInLastScan ||
        historyCase.closedDate ||
        historyCase.closedAt ||
        historyCase.historyOutcome.type !== "unresolved" ||
        historyCase.historyOutcome.category !== "active" ||
        historyCase.historyOutcome.evaluatedAt !== historyCase.lastObservedAt
      ) {
        throw new Error(`Invalid current lifecycle state: ${historyCase.id}`);
      }
    } else if (historyCase.status === "stale") {
      if (
        !historyCase.staleSinceDate ||
        historyCase.consecutiveMissCount <= 0 ||
        historyCase.tracking.observedInLastScan ||
        historyCase.closedDate ||
        historyCase.closedAt ||
        historyCase.historyOutcome.type !== "unresolved" ||
        historyCase.historyOutcome.category !== "active" ||
        historyCase.historyOutcome.evaluatedAt !== historyCase.lastObservedAt ||
        historyCase.staleSinceDate < historyCase.lastObservedDate
      ) {
        throw new Error(`Invalid stale lifecycle state: ${historyCase.id}`);
      }
    } else if (
      !historyCase.closedDate ||
      !historyCase.closedAt ||
      historyCase.historyOutcome.type === "unresolved" ||
      historyCase.historyOutcome.category === "active" ||
      historyCase.closeReview.status !== "confirmed" ||
      !historyCase.closeReview.policyVersion ||
      historyCase.closeReview.reasons.length === 0 ||
      historyCase.historyOutcome.evaluatedAt !== historyCase.closedAt ||
      historyCase.closedDate < historyCase.lastObservedDate ||
      Date.parse(historyCase.closedAt) < Date.parse(historyCase.lastObservedAt) ||
      historyCase.closeReview.policyVersion !== historyCase.events.at(-1)?.policyVersion ||
      historyCase.closeReview.reasons[0] !== historyCase.events.at(-1)?.reason ||
      historyCase.historyOutcome.reason !== historyCase.events.at(-1)?.reason ||
      historyCase.events.at(-1)?.type !== "closed"
    ) {
      throw new Error(`Invalid closed lifecycle state: ${historyCase.id}`);
    }
    if (historyCase.status === "closed") {
      const closeEvent = historyCase.events.at(-1)!;
      if (
        closeEvent.occurredAt !== historyCase.closedAt ||
        closeEvent.asOfDate !== historyCase.closedDate ||
        (closeEvent.operationDigest &&
          (closeEvent.provenance !== "manual" && closeEvent.provenance !== "policy" ||
            closeEvent.operationDigest !==
              createCloseDigest({
                caseId: historyCase.id,
                closedDate: historyCase.closedDate,
                outcomeType: historyCase.historyOutcome.type as LongTermClosedOutcomeType,
                category: historyCase.historyOutcome.category as "profit" | "loss" | "neutral" | "excluded",
                reason: closeEvent.reason,
                policyVersion: closeEvent.policyVersion,
                provenance: closeEvent.provenance
              })))
      ) {
        throw new Error(`Invalid long-term close event: ${historyCase.id}`);
      }
    }
  }

  const summaries = summarizeCases(payload.cases);
  if (JSON.stringify(payload.commonSummary) !== JSON.stringify(summaries.commonSummary)) {
    throw new Error("Long-term history commonSummary does not match cases.");
  }
  for (const [key, value] of Object.entries(summaries.strategyCounts)) {
    if (payload.strategySummary[key as keyof typeof summaries.strategyCounts] !== value) {
      throw new Error(`Long-term history strategySummary mismatch: ${key}`);
    }
  }

  const latestScan = payload.appliedScans.at(-1);
  if (latestScan) {
    if (
      payload.asOfDate !== latestScan.asOfDate ||
      Date.parse(payload.generatedAt) < Date.parse(latestScan.capturedAt) ||
      payload.strategySummary.lastScanUniverseSize !== latestScan.universeSize ||
      payload.strategySummary.lastScanCandidateCount !== latestScan.candidateCount ||
      payload.strategySummary.lastScanActionableCount !== latestScan.actionableCount ||
      payload.strategySummary.lastScanCompleteness !== latestScan.scanCompleteness
    ) {
      throw new Error("Long-term history last scan summary does not match appliedScans.");
    }
  } else if (
    payload.asOfDate !== null ||
    payload.strategySummary.lastScanUniverseSize !== 0 ||
    payload.strategySummary.lastScanCandidateCount !== 0 ||
    payload.strategySummary.lastScanActionableCount !== 0 ||
    payload.strategySummary.lastScanCompleteness !== "unknown"
  ) {
    throw new Error("Empty long-term history has non-empty last scan summary.");
  }
}

function validatePayload(value: unknown): LongTermRecommendationHistoryPayload {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid long-term recommendation history: ${z.prettifyError(parsed.error)}`);
  }
  const payload = parsed.data as LongTermRecommendationHistoryPayload;
  assertPayloadSemantics(payload);
  return payload;
}

function parsePayload(raw: string) {
  return validatePayload(JSON.parse(raw));
}

async function readPayloadFromPath(filePath: string) {
  try {
    return parsePayload(await readFile(filePath, "utf8"));
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return createEmptyPayload();
    }
    throw error;
  }
}

function resolveBucket(candidate: LongTermScanCandidate): LongTermHistoryBucket {
  if (candidate.candidateGroup === "buy candidate") {
    return "buy";
  }
  if (candidate.candidateGroup === "accumulate candidate") {
    return "accumulate";
  }
  return "watch";
}

function createSnapshot(params: {
  candidate: LongTermScanCandidate;
  bucket: LongTermHistoryBucket;
  capturedAt: string;
  asOfDate: string;
}) {
  return {
    ...params.candidate,
    capturedAt: params.capturedAt,
    asOfDate: params.asOfDate,
    referencePrice: params.candidate.price,
    priceSource: "scan_close" as const,
    bucket: params.bucket,
    policyVersion: LONG_TERM_HISTORY_POLICY_VERSION
  };
}

function createDataQuality(params: {
  candidate: LongTermScanCandidate;
  scanId: string;
  scanCompleteness: LongTermScanCompleteness;
}) {
  return {
    scanId: params.scanId,
    scanCompleteness: params.scanCompleteness,
    priceLoaded: true,
    financialsLoaded: Boolean(params.candidate.financials ?? params.candidate.fundamentals),
    reconstructed: false,
    reconstructionSources: [],
    warnings:
      params.scanCompleteness === "unknown"
        ? ["Scan completeness was not supplied; absence cannot change lifecycle state."]
        : params.scanCompleteness === "partial"
          ? ["Partial scan; absent symbols were not marked stale."]
          : []
  };
}

function createScanEvent(params: {
  historyCaseId: string;
  type: "recommendation_started" | "bucket_changed" | "observation" | "stale_marked" | "reobserved";
  capturedAt: string;
  asOfDate: string;
  scanId: string;
  reason: string;
  candidate?: LongTermScanCandidate;
  bucket?: LongTermHistoryBucket;
  fromBucket?: LongTermHistoryBucket;
}) {
  return {
    id: `${params.historyCaseId}:${params.scanId}:${params.type}`,
    type: params.type,
    occurredAt: params.capturedAt,
    asOfDate: params.asOfDate,
    scanId: params.scanId,
    bucket: params.bucket,
    fromBucket: params.fromBucket,
    toBucket:
      params.fromBucket && params.bucket && params.fromBucket !== params.bucket
        ? params.bucket
        : undefined,
    referencePrice: params.candidate?.price,
    totalScore: params.candidate?.scores.totalScore,
    reason: params.reason,
    policyVersion: LONG_TERM_HISTORY_POLICY_VERSION,
    provenance: "live_scan" as const,
    inferred: false
  } satisfies LongTermHistoryEvent;
}

function createReturnMetrics(
  initialReferencePrice: number,
  latestPrice: number,
  previous: LongTermRecommendationHistoryCase["returnMetrics"] | undefined,
  evaluatedAt: string
) {
  const maxObservedPrice = Math.max(previous?.maxObservedPrice ?? initialReferencePrice, latestPrice);
  const minObservedPrice = Math.min(previous?.minObservedPrice ?? initialReferencePrice, latestPrice);
  return {
    signalBasisPrice: initialReferencePrice,
    latestPrice,
    latestSignalReturnPct: calculateReturnPct(latestPrice, initialReferencePrice),
    maxObservedPrice,
    minObservedPrice,
    maxObservedReturnPct: calculateReturnPct(maxObservedPrice, initialReferencePrice),
    minObservedReturnPct: calculateReturnPct(minObservedPrice, initialReferencePrice),
    evaluatedAt
  };
}

function getNextCycleNo(cases: LongTermRecommendationHistoryCase[], symbol: string) {
  return (
    cases.reduce(
      (highest, historyCase) =>
        historyCase.symbol === symbol ? Math.max(highest, historyCase.cycleNo) : highest,
      0
    ) + 1
  );
}

function findOpenCase(cases: LongTermRecommendationHistoryCase[], symbol: string) {
  return [...cases]
    .reverse()
    .find(
      (historyCase) =>
        historyCase.symbol === symbol &&
        (historyCase.status === "current" || historyCase.status === "stale")
    );
}

function resolveEffectiveCurrentPicks(params: {
  previous: LongTermRecommendationHistoryPayload;
  currentPicks: ServerLongTermPick[];
  candidates: LongTermScanCandidate[];
  asOfDate: string;
}) {
  const candidateBySymbol = new Map(
    params.candidates.map((candidate) => [candidate.symbol, candidate] as const)
  );
  return params.currentPicks.map((pick) => {
    const openCase = findOpenCase(params.previous.cases, pick.symbol);
    const candidate = candidateBySymbol.get(pick.symbol);
    const nextBucket = candidate ? resolveBucket(candidate) : pick.longTermBucket;
    if (openCase?.cycleNo && openCase.cycleNo > 1) {
      const bucketChanged =
        nextBucket !== undefined && nextBucket !== openCase.lastObservedBucket;
      return {
        ...pick,
        anchorDate: openCase.candidateAnchorDate ?? openCase.openedDate,
        bucketEnteredDate: bucketChanged
          ? pick.bucketEnteredDate ?? params.asOfDate
          : openCase.bucketEnteredDate ?? openCase.openedDate
      };
    }
    if (
      !openCase &&
      candidate &&
      resolveBucket(candidate) !== "watch" &&
      getNextCycleNo(params.previous.cases, pick.symbol) > 1
    ) {
      return {
        ...pick,
        anchorDate: params.asOfDate,
        bucketEnteredDate: params.asOfDate
      };
    }
    return pick;
  });
}

function createHistoryCase(params: {
  candidate: LongTermScanCandidate;
  pick?: ServerLongTermPick;
  bucket: "accumulate" | "buy";
  cycleNo: number;
  capturedAt: string;
  asOfDate: string;
  scanId: string;
  scanCompleteness: LongTermScanCompleteness;
}) {
  const id = `longTerm:${params.candidate.symbol}:${params.cycleNo}`;
  const snapshot = createSnapshot(params);
  const event = createScanEvent({
    historyCaseId: id,
    type: "recommendation_started",
    capturedAt: params.capturedAt,
    asOfDate: params.asOfDate,
    scanId: params.scanId,
    reason: params.bucket === "buy" ? "direct_buy_scan" : "first_actionable_scan",
    candidate: params.candidate,
    bucket: params.bucket
  });

  return {
    id,
    strategy: "longTerm" as const,
    cycleNo: params.cycleNo,
    symbol: params.candidate.symbol,
    name: params.candidate.name,
    sourceKey: params.pick?.key,
    openedAt: params.capturedAt,
    openedDate: params.asOfDate,
    lastObservedAt: params.capturedAt,
    lastObservedDate: params.asOfDate,
    candidateAnchorDate:
      params.cycleNo > 1 ? params.asOfDate : params.pick?.anchorDate,
    bucketEnteredDate:
      params.cycleNo > 1 ? params.asOfDate : params.pick?.bucketEnteredDate,
    consecutiveMissCount: 0,
    status: "current" as const,
    entryBucket: params.bucket,
    lastObservedBucket: params.bucket,
    initialReferencePrice: params.candidate.price,
    lastObservedPrice: params.candidate.price,
    events: [event],
    modelPosition: {
      policyStatus: "pending" as const,
      budgetMode: "unconfigured" as const,
      caseBudget: null,
      allocationCapPct: null,
      availableNow: null,
      filledAmount: 0,
      tranches: []
    },
    returnMetrics: createReturnMetrics(
      params.candidate.price,
      params.candidate.price,
      undefined,
      params.capturedAt
    ),
    historyOutcome: {
      type: "unresolved" as const,
      category: "active" as const,
      evaluatedAt: params.capturedAt,
      reason: "awaiting_explicit_close"
    },
    dataQuality: createDataQuality({
      candidate: params.candidate,
      scanId: params.scanId,
      scanCompleteness: params.scanCompleteness
    }),
    tracking: {
      lastProcessedScanId: params.scanId,
      lastProcessedAsOfDate: params.asOfDate,
      observedInLastScan: true,
      scanCompleteness: params.scanCompleteness
    },
    closeReview: {
      status: "not_configured" as const,
      reasons: []
    },
    strategyData: {
      candidateType: params.candidate.candidateType,
      initialSnapshot: snapshot,
      latestSnapshot: snapshot,
      planRevisions: [],
      reviewSchedule: {
        status: "not_configured" as const,
        nextReviewDate: null
      },
      invalidation: {
        status: "not_triggered" as const,
        reasons: []
      }
    }
  } satisfies LongTermRecommendationHistoryCase;
}

function updateObservedHistoryCase(params: {
  historyCase: LongTermRecommendationHistoryCase;
  candidate: LongTermScanCandidate;
  pick?: ServerLongTermPick;
  bucket: LongTermHistoryBucket;
  capturedAt: string;
  asOfDate: string;
  scanId: string;
  scanCompleteness: LongTermScanCompleteness;
}) {
  const wasStale = params.historyCase.status === "stale";
  const bucketChanged = params.historyCase.lastObservedBucket !== params.bucket;
  const eventType = wasStale ? "reobserved" : bucketChanged ? "bucket_changed" : "observation";
  const event = createScanEvent({
    historyCaseId: params.historyCase.id,
    type: eventType,
    capturedAt: params.capturedAt,
    asOfDate: params.asOfDate,
    scanId: params.scanId,
    reason: wasStale
      ? "candidate_reobserved"
      : bucketChanged
        ? "scan_bucket_changed"
        : "scheduled_scan_observation",
    candidate: params.candidate,
    bucket: params.bucket,
    fromBucket: bucketChanged ? params.historyCase.lastObservedBucket : undefined
  });
  const latestSnapshot = createSnapshot(params);

  return {
    ...params.historyCase,
    name: params.candidate.name,
    sourceKey: params.pick?.key ?? params.historyCase.sourceKey,
    lastObservedAt: params.capturedAt,
    lastObservedDate: params.asOfDate,
    bucketEnteredDate: bucketChanged
      ? params.pick?.bucketEnteredDate ?? params.asOfDate
      : params.historyCase.bucketEnteredDate,
    staleSinceDate: undefined,
    consecutiveMissCount: 0,
    status: "current" as const,
    lastObservedBucket: params.bucket,
    lastObservedPrice: params.candidate.price,
    events: [...params.historyCase.events, event],
    returnMetrics: createReturnMetrics(
      params.historyCase.initialReferencePrice,
      params.candidate.price,
      params.historyCase.returnMetrics,
      params.capturedAt
    ),
    historyOutcome: {
      type: "unresolved" as const,
      category: "active" as const,
      evaluatedAt: params.capturedAt,
      reason: "awaiting_explicit_close"
    },
    dataQuality: createDataQuality({
      candidate: params.candidate,
      scanId: params.scanId,
      scanCompleteness: params.scanCompleteness
    }),
    tracking: {
      lastProcessedScanId: params.scanId,
      lastProcessedAsOfDate: params.asOfDate,
      observedInLastScan: true,
      scanCompleteness: params.scanCompleteness
    },
    strategyData: {
      ...params.historyCase.strategyData,
      candidateType: params.candidate.candidateType,
      latestSnapshot
    }
  } satisfies LongTermRecommendationHistoryCase;
}

function markHistoryCaseStale(params: {
  historyCase: LongTermRecommendationHistoryCase;
  capturedAt: string;
  asOfDate: string;
  scanId: string;
  scanCompleteness: LongTermScanCompleteness;
}) {
  const firstMiss = params.historyCase.status === "current";
  const events = firstMiss
    ? [
        ...params.historyCase.events,
        createScanEvent({
          historyCaseId: params.historyCase.id,
          type: "stale_marked",
          capturedAt: params.capturedAt,
          asOfDate: params.asOfDate,
          scanId: params.scanId,
          reason: "not_in_latest_candidate_output",
          bucket: params.historyCase.lastObservedBucket
        })
      ]
    : params.historyCase.events;

  return {
    ...params.historyCase,
    status: "stale" as const,
    staleSinceDate: params.historyCase.staleSinceDate ?? params.asOfDate,
    consecutiveMissCount: params.historyCase.consecutiveMissCount + 1,
    events,
    tracking: {
      lastProcessedScanId: params.scanId,
      lastProcessedAsOfDate: params.asOfDate,
      observedInLastScan: false,
      scanCompleteness: params.scanCompleteness
    }
  } satisfies LongTermRecommendationHistoryCase;
}

function isCaseInScope(historyCase: LongTermRecommendationHistoryCase, scope: LongTermHistoryScanScope) {
  return scope.mode === "full_universe" || scope.symbols.includes(historyCase.symbol);
}

function assertLiveScanOrder(params: {
  previous: LongTermRecommendationHistoryPayload;
  asOfDate: string;
  capturedAt: string;
}) {
  const latestScan = params.previous.appliedScans.at(-1);
  if (latestScan && params.asOfDate < latestScan.asOfDate) {
    throw new Error(
      `Stale long-term scan rejected: ${params.asOfDate} is older than ${latestScan.asOfDate}.`
    );
  }
  if (
    latestScan &&
    Date.parse(params.capturedAt) <= Date.parse(params.previous.generatedAt)
  ) {
    throw new Error(
      `Out-of-order long-term scan rejected for ${params.asOfDate}: ${params.capturedAt}.`
    );
  }
}

function resolveAutoScanId(previous: LongTermRecommendationHistoryPayload, scanIdBase: string) {
  let occurrence =
    previous.appliedScans.filter(
      (scan) => scan.scanId === scanIdBase || scan.scanId.startsWith(`${scanIdBase}:occ`)
    ).length + 1;
  let scanId = `${scanIdBase}:occ${occurrence}`;
  while (previous.appliedScans.some((scan) => scan.scanId === scanId)) {
    occurrence += 1;
    scanId = `${scanIdBase}:occ${occurrence}`;
  }
  return scanId;
}

function createCloseDigest(input: {
  caseId: string;
  closedDate: string;
  outcomeType: LongTermClosedOutcomeType;
  category: "profit" | "loss" | "neutral" | "excluded";
  reason: string;
  policyVersion: string;
  provenance: "manual" | "policy";
}) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function buildUpdateResult(params: {
  payload: LongTermRecommendationHistoryPayload;
  status: "applied" | "deduplicated";
  startedCaseCount: number;
  updatedCaseCount: number;
  skippedWatchCount: number;
  appendedEventCount: number;
  asOfDate: string;
  scanId: string;
  digest: string;
  currentPickDateOverrides: LongTermRecommendationHistoryUpdateResult["currentPickDateOverrides"];
}): LongTermRecommendationHistoryUpdateResult {
  const scanStartedCases = params.payload.cases
    .filter((historyCase) => historyCase.events[0]?.scanId === params.scanId)
    .map((historyCase) => ({
      symbol: historyCase.symbol,
      cycleNo: historyCase.cycleNo
    }));
  return {
    status: params.status,
    deduplicated: params.status === "deduplicated",
    caseCount: params.payload.commonSummary.caseCount,
    currentCaseCount: params.payload.commonSummary.currentCaseCount,
    staleCaseCount: params.payload.commonSummary.staleCaseCount,
    startedCaseCount: params.startedCaseCount,
    updatedCaseCount: params.updatedCaseCount,
    skippedWatchCount: params.skippedWatchCount,
    appendedEventCount: params.appendedEventCount,
    asOfDate: params.asOfDate,
    scanId: params.scanId,
    digest: params.digest,
    scanStartedCases,
    currentPickDateOverrides: params.currentPickDateOverrides
  };
}

export async function readLongTermRecommendationHistory(options?: LongTermHistoryStorageOptions) {
  return readPayloadFromPath(options?.filePath ?? longTermRecommendationHistoryPath);
}

export async function updateLongTermRecommendationHistoryFromScan(
  input: LongTermHistoryUpdateInput,
  options?: LongTermHistoryStorageOptions
): Promise<LongTermRecommendationHistoryUpdateResult> {
  if (!isValidIsoDate(input.asOfDate)) {
    throw new Error(`Invalid long-term history asOfDate: ${input.asOfDate}`);
  }

  const capturedAt = input.capturedAt ?? new Date().toISOString();
  if (!ISO_DATE_TIME_PATTERN.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) {
    throw new Error(`Invalid long-term history capturedAt: ${capturedAt}`);
  }

  const scanCompleteness = input.scanCompleteness ?? "unknown";
  const candidates = normalizeCandidates(input.candidates);
  const currentPicks = normalizeCurrentPicks(input.currentPicks);
  const scope = normalizeScope(input.scope);
  if (scope.mode === "full_universe" && scanCompleteness !== "complete") {
    throw new Error(
      `Incomplete full-universe long-term scan rejected: ${scanCompleteness}.`
    );
  }
  if (scope.mode === "symbols") {
    const scopeSymbols = new Set(scope.symbols);
    const outOfScopeCandidate = candidates.find((candidate) => !scopeSymbols.has(candidate.symbol));
    if (outOfScopeCandidate) {
      throw new Error(`Candidate ${outOfScopeCandidate.symbol} is outside the declared scan scope.`);
    }
    const outOfScopePick = currentPicks.find((pick) => !scopeSymbols.has(pick.symbol));
    if (outOfScopePick) {
      throw new Error(`Current pick ${outOfScopePick.symbol} is outside the declared scan scope.`);
    }
  }

  const filePath = options?.filePath ?? longTermRecommendationHistoryPath;

  return withJsonFileMutation(filePath, async () => {
    const previous = await readPayloadFromPath(filePath);
    const effectiveCurrentPicks = resolveEffectiveCurrentPicks({
      previous,
      currentPicks,
      candidates,
      asOfDate: input.asOfDate
    });
    const currentPickDateOverrides = effectiveCurrentPicks.flatMap((pick, index) => {
      const original = currentPicks[index]!;
      return pick.anchorDate !== original.anchorDate ||
        pick.bucketEnteredDate !== original.bucketEnteredDate
        ? [
            {
              symbol: pick.symbol,
              anchorDate: pick.anchorDate,
              bucketEnteredDate: pick.bucketEnteredDate
            }
          ]
        : [];
    });
    const identity = createLongTermHistoryScanIdentity({
      ...input,
      candidates,
      currentPicks: effectiveCurrentPicks,
      scanCompleteness,
      scope
    });
    const pickBySymbol = new Map(
      effectiveCurrentPicks.map((pick) => [pick.symbol, pick] as const)
    );
    const appliedScan = identity.explicitScanId
      ? previous.appliedScans.find((scan) => scan.scanId === identity.scanId)
      : undefined;
    if (identity.explicitScanId && appliedScan) {
      if (appliedScan.digest !== identity.digest) {
        throw new Error(`Long-term scanId conflict: ${identity.scanId}`);
      }
      return buildUpdateResult({
        payload: previous,
        status: "deduplicated",
        startedCaseCount: 0,
        updatedCaseCount: 0,
        skippedWatchCount: 0,
        appendedEventCount: 0,
        asOfDate: input.asOfDate,
        scanId: identity.scanId,
        digest: identity.digest,
        currentPickDateOverrides
      });
    }

    const latestAppliedScan = previous.appliedScans.at(-1);
    if (
      !identity.explicitScanId &&
      latestAppliedScan?.digest === identity.digest &&
      latestAppliedScan.asOfDate === input.asOfDate &&
      previous.generatedAt === latestAppliedScan.capturedAt
    ) {
      return buildUpdateResult({
        payload: previous,
        status: "deduplicated",
        startedCaseCount: 0,
        updatedCaseCount: 0,
        skippedWatchCount: 0,
        appendedEventCount: 0,
        asOfDate: input.asOfDate,
        scanId: latestAppliedScan.scanId,
        digest: identity.digest,
        currentPickDateOverrides
      });
    }

    assertLiveScanOrder({
      previous,
      asOfDate: input.asOfDate,
      capturedAt
    });
    const scanId = identity.explicitScanId
      ? identity.scanId
      : resolveAutoScanId(previous, identity.scanId);

    const cases = [...previous.cases];
    const observedSymbols = new Set<string>();
    let startedCaseCount = 0;
    let updatedCaseCount = 0;
    let skippedWatchCount = 0;
    let appendedEventCount = 0;

    for (const candidate of identity.candidates) {
      const bucket = resolveBucket(candidate);
      const existing = findOpenCase(cases, candidate.symbol);
      const pick = pickBySymbol.get(candidate.symbol);
      observedSymbols.add(candidate.symbol);

      if (!existing) {
        if (bucket === "watch") {
          skippedWatchCount += 1;
          continue;
        }
        cases.push(
          createHistoryCase({
            candidate,
            pick,
            bucket,
            cycleNo: getNextCycleNo(cases, candidate.symbol),
            capturedAt,
            asOfDate: input.asOfDate,
            scanId,
            scanCompleteness
          })
        );
        startedCaseCount += 1;
        appendedEventCount += 1;
        continue;
      }

      const caseIndex = cases.indexOf(existing);
      const previousEventCount = existing.events.length;
      cases[caseIndex] = updateObservedHistoryCase({
        historyCase: existing,
        candidate,
        pick,
        bucket,
        capturedAt,
        asOfDate: input.asOfDate,
        scanId,
        scanCompleteness
      });
      updatedCaseCount += 1;
      appendedEventCount += cases[caseIndex]!.events.length - previousEventCount;
    }

    if (scanCompleteness === "complete") {
      for (let index = 0; index < cases.length; index += 1) {
        const historyCase = cases[index]!;
        if (
          historyCase.status === "closed" ||
          observedSymbols.has(historyCase.symbol) ||
          !isCaseInScope(historyCase, identity.scope)
        ) {
          continue;
        }
        const previousEventCount = historyCase.events.length;
        cases[index] = markHistoryCaseStale({
          historyCase,
          capturedAt,
          asOfDate: input.asOfDate,
          scanId,
          scanCompleteness
        });
        updatedCaseCount += 1;
        appendedEventCount += cases[index]!.events.length - previousEventCount;
      }
    }

    const actionableCount = identity.candidates.filter(
      (candidate) => resolveBucket(candidate) !== "watch"
    ).length;
    const nextAppliedScan: LongTermAppliedScan = {
      scanId,
      digest: identity.digest,
      asOfDate: input.asOfDate,
      capturedAt,
      universeSize: input.universeSize,
      candidateCount: identity.candidates.length,
      actionableCount,
      scanCompleteness,
      scope: identity.scope
    };
    const summaries = summarizeCases(cases);
    const next: LongTermRecommendationHistoryPayload = {
      ...previous,
      generatedAt: capturedAt,
      asOfDate: input.asOfDate,
      commonSummary: summaries.commonSummary,
      strategySummary: {
        ...summaries.strategyCounts,
        lastScanUniverseSize: input.universeSize,
        lastScanCandidateCount: identity.candidates.length,
        lastScanActionableCount: actionableCount,
        lastScanCompleteness: scanCompleteness
      },
      appliedScans: [...previous.appliedScans, nextAppliedScan],
      cases
    };

    const validated = validatePayload(next);
    await writeJsonFileAtomic(filePath, validated);

    return buildUpdateResult({
      payload: validated,
      status: "applied",
      startedCaseCount,
      updatedCaseCount,
      skippedWatchCount,
      appendedEventCount,
      asOfDate: input.asOfDate,
      scanId,
      digest: identity.digest,
      currentPickDateOverrides
    });
  });
}

export async function closeLongTermRecommendationHistoryCase(
  input: CloseLongTermRecommendationHistoryInput,
  options?: LongTermHistoryStorageOptions
) {
  if (!isValidIsoDate(input.closedDate)) {
    throw new Error(`Invalid long-term history closedDate: ${input.closedDate}`);
  }
  const closedAt = input.closedAt ?? new Date().toISOString();
  if (!ISO_DATE_TIME_PATTERN.test(closedAt) || !Number.isFinite(Date.parse(closedAt))) {
    throw new Error(`Invalid long-term history closedAt: ${closedAt}`);
  }
  if (!input.reason.trim() || !input.policyVersion.trim()) {
    throw new Error("Long-term history close requires reason and policyVersion.");
  }

  const reason = input.reason.trim();
  const policyVersion = input.policyVersion.trim();
  const closeDigest = createCloseDigest({
    caseId: input.caseId,
    closedDate: input.closedDate,
    outcomeType: input.outcomeType,
    category: input.category,
    reason,
    policyVersion,
    provenance: input.provenance
  });
  const closeId = input.closeId ?? `close:${closeDigest.slice(0, 24)}`;
  const filePath = options?.filePath ?? longTermRecommendationHistoryPath;

  return withJsonFileMutation(filePath, async () => {
    const previous = await readPayloadFromPath(filePath);
    const caseIndex = previous.cases.findIndex((historyCase) => historyCase.id === input.caseId);
    if (caseIndex < 0) {
      throw new Error(`Long-term history case not found: ${input.caseId}`);
    }
    const historyCase = previous.cases[caseIndex]!;
    const closeEventId = `${historyCase.id}:${closeId}:closed`;
    if (historyCase.status === "closed") {
      const existingCloseEvent = historyCase.events.find((event) => event.id === closeEventId);
      if (existingCloseEvent) {
        let existingCloseDigest = existingCloseEvent.operationDigest;
        if (
          !existingCloseDigest &&
          historyCase.historyOutcome.type !== "unresolved" &&
          historyCase.historyOutcome.category !== "active" &&
          (existingCloseEvent.provenance === "manual" || existingCloseEvent.provenance === "policy")
        ) {
          existingCloseDigest = createCloseDigest({
            caseId: historyCase.id,
            closedDate: existingCloseEvent.asOfDate,
            outcomeType: historyCase.historyOutcome.type,
            category: historyCase.historyOutcome.category,
            reason: existingCloseEvent.reason,
            policyVersion: existingCloseEvent.policyVersion,
            provenance: existingCloseEvent.provenance
          });
        }
        if (existingCloseDigest === closeDigest) {
          return {
            status: "deduplicated" as const,
            caseId: historyCase.id,
            cycleNo: historyCase.cycleNo,
            closeId
          };
        }
        throw new Error(`Long-term closeId conflict: ${closeId}`);
      }
      throw new Error(`Long-term history case is already closed: ${historyCase.id}`);
    }

    const latestCaseEvent = historyCase.events.at(-1)!;
    if (input.closedDate < latestCaseEvent.asOfDate) {
      throw new Error(
        `Stale long-term close rejected: ${input.closedDate} is older than ${latestCaseEvent.asOfDate}.`
      );
    }
    if (
      Date.parse(closedAt) <= Date.parse(previous.generatedAt) ||
      Date.parse(closedAt) <= Date.parse(latestCaseEvent.occurredAt)
    ) {
      throw new Error(`Out-of-order long-term close rejected: ${closedAt}.`);
    }

    const closeEvent: LongTermHistoryEvent = {
      id: closeEventId,
      type: "closed",
      occurredAt: closedAt,
      asOfDate: input.closedDate,
      scanId: closeId,
      bucket: historyCase.lastObservedBucket,
      referencePrice: historyCase.lastObservedPrice,
      reason,
      policyVersion,
      provenance: input.provenance,
      inferred: false,
      operationDigest: closeDigest
    };
    const closedCase: LongTermRecommendationHistoryCase = {
      ...historyCase,
      status: "closed",
      closedAt,
      closedDate: input.closedDate,
      events: [...historyCase.events, closeEvent],
      historyOutcome: {
        type: input.outcomeType,
        category: input.category,
        evaluatedAt: closedAt,
        reason
      },
      closeReview: {
        status: "confirmed",
        policyVersion,
        reasons: [reason]
      }
    };
    const cases = [...previous.cases];
    cases[caseIndex] = closedCase;
    const summaries = summarizeCases(cases);
    const next: LongTermRecommendationHistoryPayload = {
      ...previous,
      generatedAt: closedAt,
      asOfDate: previous.asOfDate,
      commonSummary: summaries.commonSummary,
      strategySummary: {
        ...previous.strategySummary,
        ...summaries.strategyCounts
      },
      cases
    };

    const validated = validatePayload(next);
    await writeJsonFileAtomic(filePath, validated);
    return {
      status: "closed" as const,
      caseId: historyCase.id,
      cycleNo: historyCase.cycleNo,
      closeId
    };
  });
}
