import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ServerDividendPick } from "./serverDividendPicks.js";
import type { ServerLongTermPick } from "./serverLongTermPicks.js";
import type { ServerSwingPick } from "./serverSwingPicks.js";
import { resolveSwingEngineProfile, type SwingEngineProfile } from "./swingProfiles.js";

export type RecommendationUniverseAlertCategory = "longTerm" | "dividend" | "swing" | "smallcapSwing";
export type RecommendationUniverseAlertBucket = "buy" | "execution" | "watch";

type RecommendationUniverseAlertItem = {
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

const recommendationUniverseAlertStatePath = path.resolve(
  process.cwd(),
  "data",
  "recommendation-universe-alert-state.json"
);

async function ensureDir() {
  await mkdir(path.dirname(recommendationUniverseAlertStatePath), { recursive: true });
}

async function readRecommendationUniverseAlertState(): Promise<RecommendationUniverseAlertState> {
  try {
    const raw = await readFile(recommendationUniverseAlertStatePath, "utf8");
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

async function writeRecommendationUniverseAlertState(state: RecommendationUniverseAlertState) {
  await ensureDir();
  await writeFile(recommendationUniverseAlertStatePath, JSON.stringify(state, null, 2), "utf8");
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
      bucket: item.longTermBucket === "watch" ? ("watch" as const) : ("buy" as const)
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

export async function diffAndRememberSwingUniverseAlerts(payload: {
  profile?: SwingEngineProfile;
  executionItems: ServerSwingPick[];
  watchItems: ServerSwingPick[];
}): Promise<RecommendationUniverseAlertDiff> {
  const state = await readRecommendationUniverseAlertState();
  const profile = resolveSwingEngineProfile(payload.profile);
  const category = profile === "smallcap" ? "smallcapSwing" : "swing";
  const currentItems = buildSwingAlertItems(payload);
  const previousSnapshot = state[category];
  const previousItems = Array.isArray(previousSnapshot?.items) ? sortAlertItems(previousSnapshot.items) : [];
  const diff = diffAlertItems({
    category,
    previous: previousItems,
    current: currentItems
  });

  state[category] = {
    updatedAt: new Date().toISOString(),
    items: currentItems
  };
  await writeRecommendationUniverseAlertState(state);
  return diff;
}

export async function diffAndRememberLongTermUniverseAlerts(
  items: ServerLongTermPick[]
): Promise<RecommendationUniverseAlertDiff> {
  const state = await readRecommendationUniverseAlertState();
  const currentItems = buildLongTermAlertItems(items);
  const previousItems = Array.isArray(state.longTerm?.items) ? sortAlertItems(state.longTerm.items) : [];
  const diff = diffAlertItems({
    category: "longTerm",
    previous: previousItems,
    current: currentItems
  });

  state.longTerm = {
    updatedAt: new Date().toISOString(),
    items: currentItems
  };
  await writeRecommendationUniverseAlertState(state);
  return diff;
}

export async function diffAndRememberDividendUniverseAlerts(
  items: ServerDividendPick[]
): Promise<RecommendationUniverseAlertDiff> {
  const state = await readRecommendationUniverseAlertState();
  const currentItems = buildDividendAlertItems(items);
  const previousItems = Array.isArray(state.dividend?.items) ? sortAlertItems(state.dividend.items) : [];
  const diff = diffAlertItems({
    category: "dividend",
    previous: previousItems,
    current: currentItems
  });

  state.dividend = {
    updatedAt: new Date().toISOString(),
    items: currentItems
  };
  await writeRecommendationUniverseAlertState(state);
  return diff;
}

export { recommendationUniverseAlertStatePath };
