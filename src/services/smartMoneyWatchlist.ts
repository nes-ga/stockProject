import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SmartMoneyPatternAnalysis, SmartMoneyWatchItem } from "../types.js";

const watchlistFilePath = path.resolve(process.cwd(), "data", "smart-money-watchlist.json");

type UpsertWatchItemInput = {
  symbol: string;
  name?: string;
  note?: string;
  enabled?: boolean;
};

async function ensureWatchlistDir() {
  await mkdir(path.dirname(watchlistFilePath), { recursive: true });
}

async function readWatchlistFile(): Promise<SmartMoneyWatchItem[]> {
  try {
    const raw = await readFile(watchlistFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is SmartMoneyWatchItem => typeof item?.symbol === "string");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

async function writeWatchlistFile(items: SmartMoneyWatchItem[]) {
  await ensureWatchlistDir();
  await writeFile(watchlistFilePath, JSON.stringify(items, null, 2), "utf8");
}

export async function listSmartMoneyWatchItems() {
  return readWatchlistFile();
}

export async function upsertSmartMoneyWatchItems(inputs: UpsertWatchItemInput[]) {
  const existing = await readWatchlistFile();
  const bySymbol = new Map(existing.map((item) => [item.symbol.toUpperCase(), item]));
  const now = new Date().toISOString();

  for (const input of inputs) {
    const symbol = input.symbol.toUpperCase();
    const previous = bySymbol.get(symbol);
    bySymbol.set(symbol, {
      symbol,
      name: input.name ?? previous?.name,
      note: input.note ?? previous?.note,
      enabled: input.enabled ?? previous?.enabled ?? true,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      lastScannedAt: previous?.lastScannedAt,
      lastMatchedBreakoutDate: previous?.lastMatchedBreakoutDate
    });
  }

  const items = [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
  await writeWatchlistFile(items);
  return items;
}

export async function removeSmartMoneyWatchItem(symbol: string) {
  const normalized = symbol.toUpperCase();
  const existing = await readWatchlistFile();
  const filtered = existing.filter((item) => item.symbol.toUpperCase() !== normalized);
  await writeWatchlistFile(filtered);
  return filtered;
}

export async function updateSmartMoneyWatchScanResults(analyses: SmartMoneyPatternAnalysis[]) {
  const existing = await readWatchlistFile();
  const bySymbol = new Map(
    analyses.map((analysis) => [analysis.symbol.toUpperCase(), analysis] as const)
  );
  const now = new Date().toISOString();

  const updated = existing.map((item) => {
    const analysis = bySymbol.get(item.symbol.toUpperCase());
    if (!analysis) {
      return item;
    }

    return {
      ...item,
      updatedAt: item.updatedAt,
      lastScannedAt: now,
      lastMatchedBreakoutDate: analysis.pattern.matched ? analysis.pattern.breakoutDate : item.lastMatchedBreakoutDate
    };
  });

  await writeWatchlistFile(updated);
  return updated;
}

export { watchlistFilePath };
