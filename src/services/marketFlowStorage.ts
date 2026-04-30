import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatDateTimeInTimeZone, getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { createLogger } from "../lib/logger.js";
import type {
  GlobalState,
  LocalState,
  MarketFlowChartRange,
  MarketFlowLatest,
  MarketFlowSnapshot,
  MarketMode,
  ThemeCategory,
  ThemeCycle,
  ThemeName,
  ThemeRotationSnapshot
} from "../types.js";

const logger = createLogger("marketFlowStorage");

export const MARKET_FLOW_HISTORY_DAYS = 730;
export const DEFAULT_CHART_RANGE: MarketFlowChartRange = "6M";
export const CHART_RANGES = ["3M", "6M", "1Y", "2Y"] as const;

const marketFlowDirPath = path.resolve(process.cwd(), "data", "market-flow");
const legacyThemeRotationSnapshotPath = path.resolve(process.cwd(), "data", "theme-rotation-snapshots.json");

export const marketFlowLatestPath = path.join(marketFlowDirPath, "market-flow-latest.json");
export const marketFlowHistoryPath = path.join(marketFlowDirPath, "market-flow-history.json");
export const themeRotationHistoryPath = path.join(marketFlowDirPath, "theme-rotation-history.json");

type LegacyThemeRotationPayload = {
  items?: unknown[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeNumber(value: unknown, fallback = 0) {
  return isFiniteNumber(value) ? value : fallback;
}

function sanitizeOptionalNumber(value: unknown) {
  return isFiniteNumber(value) ? value : undefined;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isGlobalState(value: unknown): value is GlobalState {
  return value === "RISK_ON" || value === "NEUTRAL" || value === "RISK_OFF";
}

function isLocalState(value: unknown): value is LocalState {
  return value === "STRONG" || value === "SELECTIVE" || value === "WEAK" || value === "DEFENSIVE";
}

function isMarketMode(value: unknown): value is MarketMode {
  return value === "AGGRESSIVE" || value === "SELECTIVE" || value === "NEUTRAL" || value === "DEFENSIVE";
}

function isThemeCategory(value: unknown): value is ThemeCategory {
  return value === "Growth" || value === "Cyclical" || value === "Defensive" || value === "Macro";
}

function isThemeCycle(value: unknown): value is ThemeCycle {
  return value === "ACCUMULATION" || value === "MARKUP" || value === "OVERHEAT" || value === "DISTRIBUTION" || value === "DECLINE";
}

function createEmptyLatest(): MarketFlowLatest {
  return {
    date: getCurrentIsoDate(SEOUL_TIME_ZONE),
    global: {
      score: 0,
      state: "NEUTRAL"
    },
    local: {
      score: 0,
      state: "WEAK"
    },
    themeRotationScore: 0,
    marketMode: "NEUTRAL",
    topThemes: [],
    bottomThemes: [],
    updatedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE)
  };
}

function toUtcDate(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function shiftCalendarRange(anchorDate: string, range: MarketFlowChartRange) {
  const shifted = toUtcDate(anchorDate);
  if (Number.isNaN(shifted.getTime())) {
    return anchorDate;
  }

  if (range === "3M") {
    shifted.setUTCMonth(shifted.getUTCMonth() - 3);
  } else if (range === "6M") {
    shifted.setUTCMonth(shifted.getUTCMonth() - 6);
  } else if (range === "1Y") {
    shifted.setUTCFullYear(shifted.getUTCFullYear() - 1);
  } else {
    shifted.setUTCFullYear(shifted.getUTCFullYear() - 2);
  }

  return shifted.toISOString().slice(0, 10);
}

function filterHistoryByRange<T extends { date: string }>(items: T[], range?: MarketFlowChartRange) {
  if (!items.length) {
    return [];
  }

  const resolvedRange = CHART_RANGES.includes((range ?? DEFAULT_CHART_RANGE) as MarketFlowChartRange)
    ? ((range ?? DEFAULT_CHART_RANGE) as MarketFlowChartRange)
    : DEFAULT_CHART_RANGE;
  const latestDate = items.at(-1)?.date ?? getCurrentIsoDate(SEOUL_TIME_ZONE);
  const startDate = shiftCalendarRange(latestDate, resolvedRange);
  return items.filter((item) => item.date >= startDate);
}

function trimByHistoryDays<T extends { date: string }>(items: T[]) {
  if (!items.length) {
    return [];
  }

  const latestDate = items.at(-1)?.date;
  if (!latestDate) {
    return items;
  }

  const cutoff = toUtcDate(latestDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - MARKET_FLOW_HISTORY_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return items.filter((item) => item.date >= cutoffDate);
}

function normalizeLatest(raw: unknown): MarketFlowLatest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<MarketFlowLatest>;
  if (!isIsoDate(candidate.date)) {
    return null;
  }

  return {
    date: candidate.date,
    global: {
      score: sanitizeNumber(candidate.global?.score),
      state: isGlobalState(candidate.global?.state) ? candidate.global.state : "NEUTRAL"
    },
    local: {
      score: sanitizeNumber(candidate.local?.score),
      state: isLocalState(candidate.local?.state) ? candidate.local.state : "WEAK"
    },
    themeRotationScore: sanitizeNumber(candidate.themeRotationScore),
    marketMode: isMarketMode(candidate.marketMode) ? candidate.marketMode : "NEUTRAL",
    topThemes: Array.isArray(candidate.topThemes) ? candidate.topThemes.filter((item): item is string => typeof item === "string") : [],
    bottomThemes: Array.isArray(candidate.bottomThemes)
      ? candidate.bottomThemes.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE)
  };
}

function normalizeMarketFlowSnapshot(raw: unknown): MarketFlowSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<MarketFlowSnapshot>;
  if (!isIsoDate(candidate.date)) {
    return null;
  }

  return {
    date: candidate.date,
    globalScore: sanitizeNumber(candidate.globalScore),
    globalState: isGlobalState(candidate.globalState) ? candidate.globalState : "NEUTRAL",
    localScore: sanitizeNumber(candidate.localScore),
    localState: isLocalState(candidate.localState) ? candidate.localState : "WEAK",
    themeRotationScore: sanitizeNumber(candidate.themeRotationScore),
    marketMode: isMarketMode(candidate.marketMode) ? candidate.marketMode : "NEUTRAL"
  };
}

function normalizeThemeRotationSnapshot(raw: unknown): ThemeRotationSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<ThemeRotationSnapshot>;
  if (!isIsoDate(candidate.date) || typeof candidate.theme !== "string" || typeof candidate.label !== "string" || !isThemeCategory(candidate.category)) {
    return null;
  }

  return {
    date: candidate.date,
    theme: candidate.theme as ThemeName,
    label: candidate.label,
    category: candidate.category,
    score: sanitizeNumber(candidate.score),
    relativeStrength: sanitizeNumber(candidate.relativeStrength),
    volumeScore: sanitizeNumber(candidate.volumeScore),
    momentumScore: sanitizeNumber(candidate.momentumScore),
    cycle: isThemeCycle(candidate.cycle) ? candidate.cycle : "DECLINE",
    change1d: sanitizeOptionalNumber(candidate.change1d),
    change5d: sanitizeOptionalNumber(candidate.change5d),
    change20d: sanitizeOptionalNumber(candidate.change20d)
  };
}

async function ensureMarketFlowDir() {
  await mkdir(marketFlowDirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJsonFile(filePath: string, payload: unknown) {
  await ensureMarketFlowDir();
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readLegacyThemeRotationHistory() {
  try {
    const parsed = await readJsonFile<LegacyThemeRotationPayload>(legacyThemeRotationSnapshotPath);
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeThemeRotationSnapshot).filter((item): item is ThemeRotationSnapshot => Boolean(item))
      : [];
    return items.sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.theme.localeCompare(right.theme);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    logger.warn("legacy-theme-history:read-failed", {
      message
    });
    return [];
  }
}

export async function readMarketFlowLatest() {
  try {
    const parsed = await readJsonFile<unknown>(marketFlowLatestPath);
    return normalizeLatest(parsed) ?? createEmptyLatest();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      logger.warn("market-flow-latest:read-failed", {
        message
      });
    }
    return createEmptyLatest();
  }
}

export async function writeMarketFlowLatest(latest: MarketFlowLatest) {
  const payload = normalizeLatest(latest) ?? createEmptyLatest();
  payload.updatedAt = typeof latest.updatedAt === "string" ? latest.updatedAt : formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE);
  await writeJsonFile(marketFlowLatestPath, payload);
  return payload;
}

export async function readMarketFlowHistory(range?: MarketFlowChartRange) {
  try {
    const parsed = await readJsonFile<unknown[]>(marketFlowHistoryPath);
    const items = Array.isArray(parsed)
      ? parsed.map(normalizeMarketFlowSnapshot).filter((item): item is MarketFlowSnapshot => Boolean(item))
      : [];
    const sorted = items.sort((left, right) => left.date.localeCompare(right.date));
    return filterHistoryByRange(sorted, range);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      logger.warn("market-flow-history:read-failed", {
        message
      });
    }
    return [];
  }
}

async function readAllMarketFlowHistory() {
  try {
    const parsed = await readJsonFile<unknown[]>(marketFlowHistoryPath);
    const items = Array.isArray(parsed)
      ? parsed.map(normalizeMarketFlowSnapshot).filter((item): item is MarketFlowSnapshot => Boolean(item))
      : [];
    return items.sort((left, right) => left.date.localeCompare(right.date));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      logger.warn("market-flow-history:read-all-failed", {
        message
      });
    }
    return [];
  }
}

export function trimMarketFlowHistory(history: MarketFlowSnapshot[]) {
  return trimByHistoryDays(
    [...history].sort((left, right) => left.date.localeCompare(right.date))
  );
}

export async function upsertMarketFlowSnapshot(snapshot: MarketFlowSnapshot) {
  return upsertMarketFlowSnapshots([snapshot]);
}

export async function upsertMarketFlowSnapshots(snapshots: MarketFlowSnapshot[]) {
  const normalized = snapshots.map(normalizeMarketFlowSnapshot).filter((item): item is MarketFlowSnapshot => Boolean(item));
  if (!normalized.length) {
    return readAllMarketFlowHistory();
  }

  const history = await readAllMarketFlowHistory();
  const merged = new Map(history.map((item) => [item.date, item] as const));

  for (const item of normalized) {
    merged.set(item.date, item);
  }

  const nextHistory = trimMarketFlowHistory(
    [...merged.values()].sort((left, right) => left.date.localeCompare(right.date))
  );
  await writeJsonFile(marketFlowHistoryPath, nextHistory);
  return nextHistory;
}

export async function readThemeRotationHistory(range?: MarketFlowChartRange, themes?: string[]) {
  try {
    const parsed = await readJsonFile<unknown[]>(themeRotationHistoryPath);
    const items = Array.isArray(parsed)
      ? parsed.map(normalizeThemeRotationSnapshot).filter((item): item is ThemeRotationSnapshot => Boolean(item))
      : [];
    const filteredThemes = Array.isArray(themes)
      ? new Set(themes.map((item) => item.trim()).filter(Boolean))
      : new Set<string>();
    const sorted = items.sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.theme.localeCompare(right.theme);
    });
    const ranged = filterHistoryByRange(sorted, range);
    return filteredThemes.size ? ranged.filter((item) => filteredThemes.has(item.theme)) : ranged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      logger.warn("theme-rotation-history:read-failed", {
        message
      });
    }
    const legacy = await readLegacyThemeRotationHistory();
    const filteredThemes = Array.isArray(themes)
      ? new Set(themes.map((item) => item.trim()).filter(Boolean))
      : new Set<string>();
    const ranged = filterHistoryByRange(legacy, range);
    return filteredThemes.size ? ranged.filter((item) => filteredThemes.has(item.theme)) : ranged;
  }
}

async function readAllThemeRotationHistory() {
  try {
    const parsed = await readJsonFile<unknown[]>(themeRotationHistoryPath);
    const items = Array.isArray(parsed)
      ? parsed.map(normalizeThemeRotationSnapshot).filter((item): item is ThemeRotationSnapshot => Boolean(item))
      : [];
    return items.sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.theme.localeCompare(right.theme);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      logger.warn("theme-rotation-history:read-all-failed", {
        message
      });
    }
    return readLegacyThemeRotationHistory();
  }
}

export function trimThemeRotationHistory(history: ThemeRotationSnapshot[]) {
  return trimByHistoryDays(
    [...history].sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.theme.localeCompare(right.theme);
    })
  );
}

export async function upsertThemeRotationSnapshots(snapshots: ThemeRotationSnapshot[]) {
  const normalized = snapshots.map(normalizeThemeRotationSnapshot).filter((item): item is ThemeRotationSnapshot => Boolean(item));
  const history = await readAllThemeRotationHistory();
  const merged = new Map(history.map((item) => [`${item.date}:${item.theme}`, item] as const));

  for (const snapshot of normalized) {
    merged.set(`${snapshot.date}:${snapshot.theme}`, snapshot);
  }

  const nextHistory = trimThemeRotationHistory([...merged.values()]);
  await writeJsonFile(themeRotationHistoryPath, nextHistory);
  return nextHistory;
}
