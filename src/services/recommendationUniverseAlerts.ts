import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { withJsonFileMutation, writeJsonFileAtomic } from "../lib/jsonFile.js";
import type { ServerDividendPick } from "./serverDividendPicks.js";
import type { ServerLongTermPick } from "./serverLongTermPicks.js";
import type { ServerSwingPick } from "./serverSwingPicks.js";
import { resolveSwingEngineProfile, type SwingEngineProfile } from "./swingProfiles.js";

export type RecommendationUniverseAlertCategory = "longTerm" | "dividend" | "swing" | "smallcapSwing";
export type RecommendationUniverseAlertBucket = "buy" | "accumulate" | "execution" | "watch";

export type RecommendationUniverseAlertItem = {
  symbol: string;
  name: string;
  bucket: RecommendationUniverseAlertBucket;
};

type RecommendationUniverseAlertSnapshot = {
  updatedAt: string;
  items: RecommendationUniverseAlertItem[];
};

type RecommendationUniverseAlertState = Partial<
  Record<RecommendationUniverseAlertCategory, RecommendationUniverseAlertSnapshot>
>;

export type RecommendationUniverseAlertChange = {
  symbol: string;
  name: string;
  fromBucket?: RecommendationUniverseAlertBucket;
  toBucket?: RecommendationUniverseAlertBucket;
  type: "added" | "removed" | "moved";
};

export type RecommendationUniverseAlertDiff = {
  category: RecommendationUniverseAlertCategory;
  changes: RecommendationUniverseAlertChange[];
  currentCount: number;
  previousCount: number;
};

export type RecommendationUniverseAlertPreview = {
  category: RecommendationUniverseAlertCategory;
  diff: RecommendationUniverseAlertDiff;
  currentItems: RecommendationUniverseAlertItem[];
  baseFingerprint: string;
  targetFingerprint: string;
};

type RecommendationUniverseAlertStorageOptions = {
  filePath?: string;
};

const recommendationUniverseAlertStatePath = path.resolve(
  process.cwd(),
  "data",
  "recommendation-universe-alert-state.json"
);

async function readRecommendationUniverseAlertState(
  filePath = recommendationUniverseAlertStatePath
): Promise<RecommendationUniverseAlertState> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as RecommendationUniverseAlertState;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return {};
    }
    throw error;
  }
}

async function writeRecommendationUniverseAlertState(
  state: RecommendationUniverseAlertState,
  filePath = recommendationUniverseAlertStatePath
) {
  await writeJsonFileAtomic(filePath, state);
}

function normalizeAlertItem(item: RecommendationUniverseAlertItem): RecommendationUniverseAlertItem {
  return {
    symbol: item.symbol.trim().toUpperCase(),
    name: item.name.trim(),
    bucket: item.bucket
  };
}

function sortAlertItems(items: RecommendationUniverseAlertItem[]) {
  return [...items]
    .map(normalizeAlertItem)
    .sort((left, right) => left.symbol.localeCompare(right.symbol, "en"));
}

function buildSwingAlertItems(payload: { executionItems: ServerSwingPick[]; watchItems: ServerSwingPick[] }) {
  return sortAlertItems([
    ...payload.executionItems.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      bucket: "execution" as const
    })),
    ...payload.watchItems.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      bucket: "watch" as const
    }))
  ]);
}

function buildLongTermAlertItems(items: ServerLongTermPick[]) {
  return sortAlertItems(
    items.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      bucket:
        item.longTermBucket === "watch"
          ? ("watch" as const)
          : item.longTermBucket === "accumulate"
            ? ("accumulate" as const)
            : ("buy" as const)
    }))
  );
}

function buildDividendAlertItems(items: ServerDividendPick[]) {
  return sortAlertItems(
    items.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      bucket: item.longTermBucket === "watch" ? ("watch" as const) : ("buy" as const)
    }))
  );
}

function buildSnapshotItemMap(items: RecommendationUniverseAlertItem[]) {
  const mapped = new Map<string, RecommendationUniverseAlertItem>();
  for (const item of items) {
    mapped.set(item.symbol, item);
  }
  return mapped;
}

function fingerprintAlertItems(items: RecommendationUniverseAlertItem[]) {
  return createHash("sha256").update(JSON.stringify(sortAlertItems(items))).digest("hex");
}

function compareAlertChanges(left: RecommendationUniverseAlertChange, right: RecommendationUniverseAlertChange) {
  const typeOrder = {
    added: 0,
    moved: 1,
    removed: 2
  } as const;

  if (typeOrder[left.type] !== typeOrder[right.type]) {
    return typeOrder[left.type] - typeOrder[right.type];
  }

  return left.symbol.localeCompare(right.symbol, "en");
}

function diffAlertItems(params: {
  category: RecommendationUniverseAlertCategory;
  previous: RecommendationUniverseAlertItem[];
  current: RecommendationUniverseAlertItem[];
}): RecommendationUniverseAlertDiff {
  const previousBySymbol = buildSnapshotItemMap(params.previous);
  const currentBySymbol = buildSnapshotItemMap(params.current);
  const changes: RecommendationUniverseAlertChange[] = [];

  for (const currentItem of params.current) {
    const previousItem = previousBySymbol.get(currentItem.symbol);
    if (!previousItem) {
      changes.push({
        type: "added",
        symbol: currentItem.symbol,
        name: currentItem.name,
        toBucket: currentItem.bucket
      });
      continue;
    }

    if (previousItem.bucket !== currentItem.bucket) {
      changes.push({
        type: "moved",
        symbol: currentItem.symbol,
        name: currentItem.name,
        fromBucket: previousItem.bucket,
        toBucket: currentItem.bucket
      });
    }
  }

  for (const previousItem of params.previous) {
    if (!currentBySymbol.has(previousItem.symbol)) {
      changes.push({
        type: "removed",
        symbol: previousItem.symbol,
        name: previousItem.name,
        fromBucket: previousItem.bucket
      });
    }
  }

  changes.sort(compareAlertChanges);

  return {
    category: params.category,
    changes,
    currentCount: params.current.length,
    previousCount: params.previous.length
  };
}

async function previewUniverseAlerts(
  category: RecommendationUniverseAlertCategory,
  currentItems: RecommendationUniverseAlertItem[],
  options?: RecommendationUniverseAlertStorageOptions
) {
  const filePath = options?.filePath ?? recommendationUniverseAlertStatePath;
  const state = await readRecommendationUniverseAlertState(filePath);
  const previousSnapshot = state[category];
  const previousItems = Array.isArray(previousSnapshot?.items) ? sortAlertItems(previousSnapshot.items) : [];
  const normalizedCurrentItems = sortAlertItems(currentItems);
  return {
    category,
    diff: diffAlertItems({
      category,
      previous: previousItems,
      current: normalizedCurrentItems
    }),
    currentItems: normalizedCurrentItems,
    baseFingerprint: fingerprintAlertItems(previousItems),
    targetFingerprint: fingerprintAlertItems(normalizedCurrentItems)
  } satisfies RecommendationUniverseAlertPreview;
}

export async function rememberRecommendationUniverseAlertPreview(
  preview: RecommendationUniverseAlertPreview,
  options?: RecommendationUniverseAlertStorageOptions
) {
  const filePath = options?.filePath ?? recommendationUniverseAlertStatePath;
  return withJsonFileMutation(filePath, async () => {
    const state = await readRecommendationUniverseAlertState(filePath);
    const latestItems = Array.isArray(state[preview.category]?.items)
      ? sortAlertItems(state[preview.category]!.items)
      : [];
    const latestFingerprint = fingerprintAlertItems(latestItems);

    if (latestFingerprint === preview.targetFingerprint) {
      return {
        status: "deduplicated" as const,
        category: preview.category
      };
    }
    if (latestFingerprint !== preview.baseFingerprint) {
      throw new Error(`Recommendation universe alert state changed before commit: ${preview.category}`);
    }

    state[preview.category] = {
      updatedAt: new Date().toISOString(),
      items: preview.currentItems
    };
    await writeRecommendationUniverseAlertState(state, filePath);
    return {
      status: "applied" as const,
      category: preview.category
    };
  });
}

export async function previewSwingUniverseAlerts(payload: {
  profile?: SwingEngineProfile;
  executionItems: ServerSwingPick[];
  watchItems: ServerSwingPick[];
}, options?: RecommendationUniverseAlertStorageOptions) {
  const profile = resolveSwingEngineProfile(payload.profile);
  const category = profile === "smallcap" ? "smallcapSwing" : "swing";
  const currentItems = buildSwingAlertItems(payload);
  return previewUniverseAlerts(category, currentItems, options);
}

export async function previewLongTermUniverseAlerts(
  items: ServerLongTermPick[],
  options?: RecommendationUniverseAlertStorageOptions
) {
  const currentItems = buildLongTermAlertItems(items);
  return previewUniverseAlerts("longTerm", currentItems, options);
}

export async function previewDividendUniverseAlerts(
  items: ServerDividendPick[],
  options?: RecommendationUniverseAlertStorageOptions
) {
  const currentItems = buildDividendAlertItems(items);
  return previewUniverseAlerts("dividend", currentItems, options);
}

export async function diffAndRememberSwingUniverseAlerts(payload: {
  profile?: SwingEngineProfile;
  executionItems: ServerSwingPick[];
  watchItems: ServerSwingPick[];
}): Promise<RecommendationUniverseAlertDiff> {
  const preview = await previewSwingUniverseAlerts(payload);
  await rememberRecommendationUniverseAlertPreview(preview);
  return preview.diff;
}

export async function diffAndRememberLongTermUniverseAlerts(
  items: ServerLongTermPick[]
): Promise<RecommendationUniverseAlertDiff> {
  const preview = await previewLongTermUniverseAlerts(items);
  await rememberRecommendationUniverseAlertPreview(preview);
  return preview.diff;
}

export async function diffAndRememberDividendUniverseAlerts(
  items: ServerDividendPick[]
): Promise<RecommendationUniverseAlertDiff> {
  const preview = await previewDividendUniverseAlerts(items);
  await rememberRecommendationUniverseAlertPreview(preview);
  return preview.diff;
}

export { recommendationUniverseAlertStatePath };
