import { createLogger } from "../lib/logger.js";
import type {
  DividendEtfFilterResult,
  DividendEtfFilters,
  DividendEtfRecommendation,
  DividendEtfUniverseItem
} from "../types.js";

const logger = createLogger("dividendEtfService");

const DEFAULT_DIVIDEND_ETF_FILTERS: DividendEtfFilters = {
  minDividendYield: 2.5,
  maxExpenseRatio: 0.5,
  minimumDividendHistoryYears: 3,
  excludeUnstableDistributions: true
};

// Fallback universe for the dividend ETF section until a live ETF metadata source is added.
const DIVIDEND_ETF_UNIVERSE: DividendEtfUniverseItem[] = [
  {
    symbol: "161510",
    name: "PLUS High Dividend ETF",
    category: "high dividend",
    dividendYield: 3.52,
    expenseRatio: 0.23,
    dividendHistoryYears: 10,
    dividendHistory: [
      { label: "2026-03", dividendDateLabel: "2026-03-30", dividendAmount: 86, dividendYield: 3.52 },
      { label: "2026-02", dividendDateLabel: "2026-02-26", dividendAmount: 86, dividendYield: 3.52 },
      { label: "2026-01", dividendDateLabel: "2026-01-29", dividendAmount: 86, dividendYield: 3.52 },
      { label: "2025-12", dividendDateLabel: "2025-12-29", dividendAmount: 78, dividendYield: 3.52 }
    ],
    distributionStability: "stable"
  },
  {
    symbol: "279530",
    name: "KODEX High Dividend ETF",
    category: "high dividend",
    dividendYield: 3.72,
    expenseRatio: 0.3,
    dividendHistoryYears: 8,
    dividendHistory: [
      { label: "2026-03", dividendDateLabel: "2026-03-30", dividendAmount: 65, dividendYield: 3.72 },
      { label: "2026-02", dividendDateLabel: "2026-02-26", dividendAmount: 47, dividendYield: 3.72 },
      { label: "2026-01", dividendDateLabel: "2026-01-29", dividendAmount: 45, dividendYield: 3.72 },
      { label: "2025-12", dividendDateLabel: "2025-12-29", dividendAmount: 50, dividendYield: 3.72 }
    ],
    distributionStability: "stable"
  },
  {
    symbol: "210780",
    name: "TIGER High Dividend ETF",
    category: "high dividend",
    dividendYield: 2.5,
    expenseRatio: 0.29,
    dividendHistoryYears: 10,
    dividendHistory: [
      { label: "2026-Q1", dividendDateLabel: "2026-01-29", dividendAmount: 632, dividendYield: 2.5 },
      { label: "2025-Q4", dividendDateLabel: "2025-10-31", dividendAmount: 240, dividendYield: 2.5 },
      { label: "2025-Q3", dividendDateLabel: "2025-07-31", dividendAmount: 190, dividendYield: 2.5 },
      { label: "2025-Q2", dividendDateLabel: "2025-04-30", dividendAmount: 180, dividendYield: 2.5 }
    ],
    distributionStability: "stable"
  },
  {
    symbol: "211900",
    name: "KODEX Korea Dividend Growth ETF",
    category: "dividend growth",
    dividendYield: 2.83,
    expenseRatio: 0.15,
    dividendHistoryYears: 10,
    dividendHistory: [
      { label: "2026-03", dividendDateLabel: "2026-03-30", dividendAmount: 30, dividendYield: 2.83 },
      { label: "2026-02", dividendDateLabel: "2026-02-26", dividendAmount: 24, dividendYield: 2.83 },
      { label: "2026-01", dividendDateLabel: "2026-01-29", dividendAmount: 24, dividendYield: 2.83 },
      { label: "2025-12", dividendDateLabel: "2025-12-29", dividendAmount: 30, dividendYield: 2.83 }
    ],
    distributionStability: "stable"
  },
  {
    symbol: "458730",
    name: "TIGER U.S. Dividend Equity ETF",
    category: "high dividend",
    dividendYield: 2.86,
    expenseRatio: 0.01,
    dividendHistoryYears: 2,
    distributionStability: "stable"
  },
  {
    symbol: "472150",
    name: "TIGER Dividend Premium Active ETF",
    category: "high dividend",
    dividendYield: 15.41,
    expenseRatio: 0.5,
    dividendHistoryYears: 2,
    distributionStability: "mixed",
    exclusionFlags: ["covered_call"]
  },
  {
    symbol: "321410",
    name: "KODEX Multi-Asset High Income(H)",
    category: "dividend growth",
    dividendYield: 10,
    expenseRatio: 0.25,
    dividendHistoryYears: 6,
    distributionStability: "mixed",
    exclusionFlags: ["high_risk_bond"]
  }
];

export function resolveDividendEtfFilters(filters?: Partial<DividendEtfFilters>): DividendEtfFilters {
  return {
    minDividendYield: filters?.minDividendYield ?? DEFAULT_DIVIDEND_ETF_FILTERS.minDividendYield,
    maxExpenseRatio: filters?.maxExpenseRatio ?? DEFAULT_DIVIDEND_ETF_FILTERS.maxExpenseRatio,
    minimumDividendHistoryYears:
      filters?.minimumDividendHistoryYears ?? DEFAULT_DIVIDEND_ETF_FILTERS.minimumDividendHistoryYears,
    excludeUnstableDistributions:
      filters?.excludeUnstableDistributions ?? DEFAULT_DIVIDEND_ETF_FILTERS.excludeUnstableDistributions
  };
}

export function prepareDividendEtfUniverse() {
  return DIVIDEND_ETF_UNIVERSE.map((item) => ({ ...item }));
}

export function isDividendFocusedEtf(item: DividendEtfUniverseItem) {
  const allowedCategory = item.category === "high dividend" || item.category === "dividend growth";
  if (!allowedCategory) {
    return false;
  }

  const exclusionFlags = new Set(item.exclusionFlags ?? []);
  return (
    !exclusionFlags.has("thematic") &&
    !exclusionFlags.has("leveraged") &&
    !exclusionFlags.has("inverse") &&
    !exclusionFlags.has("covered_call") &&
    !exclusionFlags.has("high_risk_bond") &&
    !exclusionFlags.has("general_growth") &&
    !exclusionFlags.has("broad_market_weak_dividend")
  );
}

function passesDividendEtfFilters(item: DividendEtfUniverseItem, filters: DividendEtfFilters) {
  if ((item.dividendYield ?? 0) < filters.minDividendYield) {
    return false;
  }

  if ((item.expenseRatio ?? Number.POSITIVE_INFINITY) > filters.maxExpenseRatio) {
    return false;
  }

  if ((item.dividendHistoryYears ?? 0) < filters.minimumDividendHistoryYears) {
    return false;
  }

  if (filters.excludeUnstableDistributions && item.distributionStability === "unstable") {
    return false;
  }

  return true;
}

function buildDividendEtfNote(item: DividendEtfUniverseItem) {
  const parts = [item.category === "dividend growth" ? "Dividend growth ETF" : "High dividend ETF"];

  if (item.distributionStability === "stable") {
    parts.push("relatively stable distribution");
  }

  if ((item.expenseRatio ?? 1) <= 0.15) {
    parts.push("low fee");
  } else if ((item.expenseRatio ?? 1) <= 0.5) {
    parts.push("meets base fee condition");
  }

  parts.push(item.category === "dividend growth" ? "suitable for long-term holding" : "defensive allocation candidate");

  return parts.slice(0, 3).join(" / ");
}

function toDividendEtfRecommendation(item: DividendEtfUniverseItem): DividendEtfRecommendation {
  return {
    symbol: item.symbol,
    name: item.name,
    dividendYield: item.dividendYield,
    expenseRatio: item.expenseRatio,
    dividendHistoryYears: item.dividendHistoryYears,
    dividendHistory: item.dividendHistory,
    category: item.category,
    distributionStability: item.distributionStability,
    note: buildDividendEtfNote(item)
  };
}

export function getDividendEtfRecommendations(filters?: Partial<DividendEtfFilters>): DividendEtfFilterResult {
  const resolvedFilters = resolveDividendEtfFilters(filters);
  const universe = prepareDividendEtfUniverse();
  const items = universe
    .filter((item) => isDividendFocusedEtf(item))
    .filter((item) => passesDividendEtfFilters(item, resolvedFilters))
    .sort(
      (left, right) =>
        (right.dividendYield ?? 0) - (left.dividendYield ?? 0) ||
        (left.expenseRatio ?? Number.POSITIVE_INFINITY) - (right.expenseRatio ?? Number.POSITIVE_INFINITY) ||
        left.name.localeCompare(right.name, "en")
    )
    .map((item) => toDividendEtfRecommendation(item));

  logger.info("filter:success", {
    universeSize: universe.length,
    filteredCount: items.length
  });

  return {
    filters: resolvedFilters,
    universeSize: universe.length,
    items
  };
}
