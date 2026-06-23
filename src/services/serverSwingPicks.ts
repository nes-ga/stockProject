import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SmartMoneyEnvelopeAnalysis, SmartMoneyPostEntryOutcome } from "../types.js";
import { resolveSwingEngineProfile, type SwingEngineProfile } from "./swingProfiles.js";

export type ServerSwingBuyPlan = {
  firstBuyPrice?: number;
  secondBuyPrice?: number;
  thirdBuyPrice?: number;
  stopLossPrice?: number;
  originalThirdBuyPrice?: number;
  adjustedThirdBuyPrice?: number;
  thirdBuyAdjustment?: {
    policy?: "market_stability_floor_confirmed";
    adjustedDate?: string;
    marketContextScore?: number;
    regimeScore?: number;
    supportStabilityScore?: number;
    volumeContractionScore?: number;
    candleQualityScore?: number;
    stopBufferPct?: number;
    supportHoldDays?: number;
    reason?: string;
  };
};

export type ServerSwingPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  bucket?: ServerSwingPickBucket;
  tags?: string[];
  reasons?: string[];
  penaltyFactors?: Array<{
    code: string;
    label: string;
    impact: number;
    reason: string;
  }>;
  buyPlan?: ServerSwingBuyPlan;
  postEntryOutcome?: SmartMoneyPostEntryOutcome;
  envelope?: SmartMoneyEnvelopeAnalysis;
  haltCategory?: string;
  haltAction?: string;
  initialStopLossPrice?: number;
  category: "swing";
  swingProfile?: SwingEngineProfile;
  source?: string;
};

export type ServerSwingPickBucket = "execution" | "execution_ready" | "execution_probe" | "watch";

export type ServerSwingPickPayload = {
  executionItems: ServerSwingPick[];
  watchItems: ServerSwingPick[];
  items: ServerSwingPick[];
};

function getServerSwingPicksPath(profile: SwingEngineProfile) {
  return path.resolve(
    process.cwd(),
    "data",
    profile === "smallcap" ? "server-smallcap-swing-picks.json" : "server-swing-picks.json"
  );
}

async function ensureDir(profile: SwingEngineProfile) {
  await mkdir(path.dirname(getServerSwingPicksPath(profile)), { recursive: true });
}

function normalizeServerSwingPick(
  item: unknown,
  fallbackBucket: ServerSwingPickBucket,
  profile: SwingEngineProfile
): ServerSwingPick | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Partial<ServerSwingPick>;
  if (
    typeof candidate.key !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.symbol !== "string" ||
    typeof candidate.anchorDate !== "string"
  ) {
    return null;
  }

  return {
    key: candidate.key,
    name: candidate.name,
    symbol: candidate.symbol,
    anchorDate: candidate.anchorDate,
    latestMentionDate: typeof candidate.latestMentionDate === "string" ? candidate.latestMentionDate : undefined,
    note: typeof candidate.note === "string" ? candidate.note : undefined,
    bucket:
      candidate.bucket === "watch"
        ? "watch"
        : candidate.bucket === "execution_ready"
          ? "execution_ready"
          : candidate.bucket === "execution_probe"
            ? "execution_probe"
            : candidate.bucket === "execution"
              ? "execution"
              : fallbackBucket,
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((item): item is string => typeof item === "string") : undefined,
    reasons: Array.isArray(candidate.reasons) ? candidate.reasons.filter((item): item is string => typeof item === "string") : undefined,
    penaltyFactors: Array.isArray(candidate.penaltyFactors)
      ? candidate.penaltyFactors.filter(
          (
            item
          ): item is {
            code: string;
            label: string;
            impact: number;
            reason: string;
          } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { code?: unknown }).code === "string" &&
            typeof (item as { label?: unknown }).label === "string" &&
            typeof (item as { impact?: unknown }).impact === "number" &&
            typeof (item as { reason?: unknown }).reason === "string"
        )
      : undefined,
    buyPlan:
      candidate.buyPlan && typeof candidate.buyPlan === "object"
        ? (candidate.buyPlan as ServerSwingBuyPlan)
        : undefined,
    postEntryOutcome:
      candidate.postEntryOutcome && typeof candidate.postEntryOutcome === "object"
        ? (candidate.postEntryOutcome as SmartMoneyPostEntryOutcome)
        : undefined,
    envelope:
      candidate.envelope && typeof candidate.envelope === "object"
        ? (candidate.envelope as SmartMoneyEnvelopeAnalysis)
        : undefined,
    haltCategory: typeof candidate.haltCategory === "string" ? candidate.haltCategory : undefined,
    haltAction: typeof candidate.haltAction === "string" ? candidate.haltAction : undefined,
    initialStopLossPrice:
      typeof candidate.initialStopLossPrice === "number" && Number.isFinite(candidate.initialStopLossPrice)
        ? candidate.initialStopLossPrice
        : undefined,
    category: "swing",
    swingProfile: typeof candidate.swingProfile === "string" ? resolveSwingEngineProfile(candidate.swingProfile) : profile,
    source: typeof candidate.source === "string" ? candidate.source : undefined
  };
}

function buildServerSwingPickPayload(raw: unknown, profile: SwingEngineProfile): ServerSwingPickPayload {
  if (Array.isArray(raw)) {
    const executionItems = raw
      .map((item) => normalizeServerSwingPick(item, "execution", profile))
      .filter((item): item is ServerSwingPick => Boolean(item));
    return {
      executionItems,
      watchItems: [],
      items: executionItems
    };
  }

  if (!raw || typeof raw !== "object") {
    return {
      executionItems: [],
      watchItems: [],
      items: []
    };
  }

  const parsed = raw as {
    executionItems?: unknown[];
    watchItems?: unknown[];
    items?: unknown[];
  };
  const legacyItems = Array.isArray(parsed.items) ? parsed.items : [];
  const executionSource = Array.isArray(parsed.executionItems) ? parsed.executionItems : legacyItems;
  const watchSource = Array.isArray(parsed.watchItems) ? parsed.watchItems : [];
  const executionItems = executionSource
    .map((item) => normalizeServerSwingPick(item, "execution", profile))
    .filter((item): item is ServerSwingPick => Boolean(item));
  const watchItems = watchSource
    .map((item) => normalizeServerSwingPick(item, "watch", profile))
    .filter((item): item is ServerSwingPick => Boolean(item));
  const merged = new Map<string, ServerSwingPick>();

  for (const item of executionItems) {
    merged.set(item.key, item);
  }

  for (const item of watchItems) {
    if (!merged.has(item.key)) {
      merged.set(item.key, item);
    }
  }

  return {
    executionItems,
    watchItems,
    items: [...merged.values()]
  };
}

async function readDefaultSwingSymbolsForSmallcapFilter() {
  try {
    const raw = await readFile(getServerSwingPicksPath("default"), "utf8");
    const parsed = JSON.parse(raw);
    const payload = buildServerSwingPickPayload(parsed, "default");
    return new Set(payload.items.map((item) => item.symbol));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return new Set<string>();
    }
    throw error;
  }
}

async function filterSmallcapPayloadAgainstDefault(payload: ServerSwingPickPayload) {
  const defaultSymbols = await readDefaultSwingSymbolsForSmallcapFilter();
  if (defaultSymbols.size === 0) {
    return payload;
  }

  return buildServerSwingPickPayload(
    {
      executionItems: payload.executionItems.filter((item) => !defaultSymbols.has(item.symbol)),
      watchItems: payload.watchItems.filter((item) => !defaultSymbols.has(item.symbol))
    },
    "smallcap"
  );
}

export async function readServerSwingPickPayload(profileInput?: SwingEngineProfile): Promise<ServerSwingPickPayload> {
  const profile = resolveSwingEngineProfile(profileInput);
  const serverSwingPicksPath = getServerSwingPicksPath(profile);
  try {
    const raw = await readFile(serverSwingPicksPath, "utf8");
    const parsed = JSON.parse(raw);
    const payload = buildServerSwingPickPayload(parsed, profile);
    return profile === "smallcap" ? filterSmallcapPayloadAgainstDefault(payload) : payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return {
        executionItems: [],
        watchItems: [],
        items: []
      };
    }
    throw error;
  }
}

export async function readServerSwingPicks(profileInput?: SwingEngineProfile): Promise<ServerSwingPick[]> {
  const payload = await readServerSwingPickPayload(profileInput);
  return payload.items;
}

export async function writeServerSwingPicks(
  input:
    | ServerSwingPick[]
    | {
        executionItems?: ServerSwingPick[];
        watchItems?: ServerSwingPick[];
        items?: ServerSwingPick[];
      },
  options?: { profile?: SwingEngineProfile }
) {
  const profile = resolveSwingEngineProfile(options?.profile);
  const parsedPayload = buildServerSwingPickPayload(input, profile);
  const payload = profile === "smallcap" ? await filterSmallcapPayloadAgainstDefault(parsedPayload) : parsedPayload;
  const serverSwingPicksPath = getServerSwingPicksPath(profile);
  await ensureDir(profile);
  await writeFile(
    serverSwingPicksPath,
    JSON.stringify(
      {
        executionItems: payload.executionItems,
        watchItems: payload.watchItems
      },
      null,
      2
    ),
    "utf8"
  );
  return payload;
}

export { getServerSwingPicksPath };
