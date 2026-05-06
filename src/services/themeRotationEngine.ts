import { formatDateTimeInTimeZone, getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { createLogger } from "../lib/logger.js";
import type {
  ChartPoint,
  MarketWatchSnapshot,
  ThemeCycle,
  ThemeRotationPayload,
  ThemeSnapshot
} from "../types.js";
import { fetchQuoteAndChart } from "./stockAnalysis.js";
import { themeGroups } from "./themeGroups.js";

const logger = createLogger("themeRotationEngine");
const THEME_CHART_SESSIONS = 120;
const THEME_FETCH_CHUNK_SIZE = 8;

type ThemeTickerSummary = {
  symbol: string;
  latestDate?: string;
  latestClose?: number;
  change1d?: number;
  change5d?: number;
  change20d?: number;
  currentTurnover?: number;
  averageTurnover20?: number;
};

export type ThemeRotationProxyMetrics = {
  breadth?: {
    source: string;
    advancingCount?: number;
    decliningCount?: number;
    advancingPercent?: number;
  };
  turnover?: {
    source: string;
    current?: number;
    average20?: number;
    ratio?: number;
  };
};

export type ThemeRotationResult = ThemeRotationPayload & {
  proxyMetrics: ThemeRotationProxyMetrics;
};

function average(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function getTurnover(point?: ChartPoint) {
  if (!point || point.volume == null) {
    return undefined;
  }

  return point.close * point.volume;
}

function getChange(points: ChartPoint[], sessionsAgo: number) {
  const latest = points.at(-1);
  const prior = points.at(-(sessionsAgo + 1));
  return latest && prior ? percentChange(latest.close, prior.close) : undefined;
}

function getAverageTurnover(points: ChartPoint[], period: number) {
  const recent = points.slice(-period - 1, -1).map(getTurnover).filter((value): value is number => typeof value === "number");
  return average(recent);
}

function getBenchmarkReturn(snapshot: MarketWatchSnapshot | undefined, sessionsAgo: number) {
  const points = snapshot?.chartSets?.daily?.points ?? [];
  return getChange(points, sessionsAgo);
}

function scoreRelativeStrength(relativeReturn20d?: number) {
  if (relativeReturn20d == null) {
    return 50;
  }

  return clamp(Math.round(50 + relativeReturn20d * 3.2), 0, 100);
}

function scoreVolumeRatio(volumeRatio?: number) {
  if (volumeRatio == null) {
    return 45;
  }

  if (volumeRatio >= 1.8) {
    return 94;
  }
  if (volumeRatio >= 1.45) {
    return 82;
  }
  if (volumeRatio >= 1.1) {
    return 68;
  }
  if (volumeRatio >= 0.9) {
    return 54;
  }
  if (volumeRatio >= 0.75) {
    return 40;
  }
  return 24;
}

function scoreMomentum(change20d?: number) {
  if (change20d == null) {
    return 45;
  }

  return clamp(Math.round(50 + change20d * 2.4), 0, 100);
}

function classifyThemeCycle(params: {
  change5d?: number;
  change20d?: number;
  relativeReturn20d?: number;
  volumeRatio?: number;
}): ThemeCycle {
  const change5d = params.change5d ?? 0;
  const change20d = params.change20d ?? 0;
  const relativeReturn20d = params.relativeReturn20d ?? 0;
  const volumeRatio = params.volumeRatio ?? 0;

  if ((change5d >= 12 || change20d >= 25) && volumeRatio >= 1.8) {
    return "OVERHEAT";
  }

  if (change20d >= 6 && relativeReturn20d >= 2 && volumeRatio >= 1) {
    return "MARKUP";
  }

  if (Math.abs(change20d) < 6 && volumeRatio >= 1.08) {
    return "ACCUMULATION";
  }

  if (change20d > -5 && change20d < 4 && volumeRatio < 0.9) {
    return "DISTRIBUTION";
  }

  return "DECLINE";
}

async function loadThemeTickerSummaries() {
  const uniqueTickers = [...new Set(themeGroups.flatMap((group) => group.tickers))];
  const summaryByTicker = new Map<string, ThemeTickerSummary>();

  for (let index = 0; index < uniqueTickers.length; index += THEME_FETCH_CHUNK_SIZE) {
    const chunk = uniqueTickers.slice(index, index + THEME_FETCH_CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(async (symbol) => {
        const result = await fetchQuoteAndChart(symbol, {
          naverCount: THEME_CHART_SESSIONS
        });
        const points = result.points;
        const latest = points.at(-1);
        const summary: ThemeTickerSummary = {
          symbol,
          latestDate: latest?.date,
          latestClose: latest?.close,
          change1d: getChange(points, 1),
          change5d: getChange(points, 5),
          change20d: getChange(points, 20),
          currentTurnover: getTurnover(latest),
          averageTurnover20: getAverageTurnover(points, 20)
        };
        return summary;
      })
    );

    settled.forEach((result, offset) => {
      const symbol = chunk[offset];
      if (result.status === "fulfilled") {
        summaryByTicker.set(symbol, result.value);
        return;
      }

      logger.warn("theme-ticker:load:failed", {
        symbol,
        message: result.reason instanceof Error ? result.reason.message : "Failed to load theme ticker chart."
      });
    });
  }

  return summaryByTicker;
}

export async function getThemeRotationPayload(params: { benchmarkSnapshots: Map<string, MarketWatchSnapshot> }): Promise<ThemeRotationResult> {
  const date = getCurrentIsoDate(SEOUL_TIME_ZONE);
  const summaryByTicker = await loadThemeTickerSummaries();
  const benchmarkByKey = params.benchmarkSnapshots;
  const snapshots: ThemeSnapshot[] = [];
  const themeProxyUniverse = [...summaryByTicker.values()];

  for (const group of themeGroups) {
    const memberNameBySymbol = new Map((group.members ?? []).map((item) => [item.symbol, item.name] as const));
    const summaries = group.tickers
      .map((ticker) => summaryByTicker.get(ticker))
      .filter((item): item is ThemeTickerSummary => Boolean(item));
    const benchmark = benchmarkByKey.get(group.benchmark ?? "KOSPI");
    const benchmarkReturn20d = getBenchmarkReturn(benchmark, 20) ?? 0;
    const averageChange1d = average(summaries.map((item) => item.change1d).filter((value): value is number => typeof value === "number"));
    const averageChange5d = average(summaries.map((item) => item.change5d).filter((value): value is number => typeof value === "number"));
    const averageChange20d = average(summaries.map((item) => item.change20d).filter((value): value is number => typeof value === "number"));
    const currentTurnover = summaries.reduce((sum, item) => sum + (item.currentTurnover ?? 0), 0);
    const averageTurnover20 = summaries.reduce((sum, item) => sum + (item.averageTurnover20 ?? 0), 0);
    const volumeRatio = averageTurnover20 > 0 ? currentTurnover / averageTurnover20 : undefined;
    const relativeReturn20d = averageChange20d != null ? averageChange20d - benchmarkReturn20d : undefined;
    const relativeStrength = scoreRelativeStrength(relativeReturn20d);
    const volumeScore = scoreVolumeRatio(volumeRatio);
    const momentumScore = scoreMomentum(averageChange20d);
    const score = clamp(Math.round(relativeStrength * 0.5 + volumeScore * 0.3 + momentumScore * 0.2), 0, 100);
    const cycle = classifyThemeCycle({
      change5d: averageChange5d,
      change20d: averageChange20d,
      relativeReturn20d,
      volumeRatio
    });
    const missingCount = group.tickers.length - summaries.length;
    const note =
      missingCount > 0
        ? `${missingCount}개 구성 종목이 응답하지 않아 ${summaries.length}개 기준으로 계산했습니다.`
        : undefined;

    snapshots.push({
      date,
      theme: group.name,
      label: group.label,
      category: group.category,
      benchmark: group.benchmark ?? "KOSPI",
      score,
      relativeStrength,
      volumeScore,
      momentumScore,
      cycle,
      memberCount: summaries.length,
      volumeRatio: volumeRatio != null ? roundNumber(volumeRatio, 3) : undefined,
      relativeReturn20d: relativeReturn20d != null ? roundNumber(relativeReturn20d) : undefined,
      benchmarkReturn20d: roundNumber(benchmarkReturn20d),
      change1d: averageChange1d != null ? roundNumber(averageChange1d) : undefined,
      change5d: averageChange5d != null ? roundNumber(averageChange5d) : undefined,
      change20d: averageChange20d != null ? roundNumber(averageChange20d) : undefined,
      sentimentScore: typeof group.sentimentScore === "number" ? group.sentimentScore : undefined,
      note,
      members: summaries.map((item) => ({
        symbol: item.symbol,
        name: memberNameBySymbol.get(item.symbol),
        latestDate: item.latestDate,
        latestClose: item.latestClose != null ? roundNumber(item.latestClose, 0) : undefined,
        change1d: item.change1d != null ? roundNumber(item.change1d) : undefined,
        change5d: item.change5d != null ? roundNumber(item.change5d) : undefined,
        change20d: item.change20d != null ? roundNumber(item.change20d) : undefined,
        currentTurnover: item.currentTurnover != null ? Math.round(item.currentTurnover) : undefined,
        averageTurnover20: item.averageTurnover20 != null ? Math.round(item.averageTurnover20) : undefined
      }))
    });
  }

  snapshots.sort((left, right) => right.score - left.score || right.change20d! - left.change20d! || left.label.localeCompare(right.label, "ko"));

  const advancingCount = themeProxyUniverse.filter((item) => (item.change1d ?? 0) > 0).length;
  const decliningCount = themeProxyUniverse.filter((item) => (item.change1d ?? 0) < 0).length;
  const breadthDenominator = Math.max(1, advancingCount + decliningCount);
  const advancingPercent = (advancingCount / breadthDenominator) * 100;
  const currentTurnover = themeProxyUniverse.reduce((sum, item) => sum + (item.currentTurnover ?? 0), 0);
  const averageTurnover20 = themeProxyUniverse.reduce((sum, item) => sum + (item.averageTurnover20 ?? 0), 0);
  const proxyMetrics: ThemeRotationProxyMetrics = {
    breadth: {
      source: "tracked-theme-universe",
      advancingCount,
      decliningCount,
      advancingPercent: roundNumber(advancingPercent)
    },
    turnover: {
      source: "tracked-theme-universe",
      current: currentTurnover,
      average20: averageTurnover20,
      ratio: averageTurnover20 > 0 ? roundNumber(currentTurnover / averageTurnover20, 3) : undefined
    }
  };

  const score = roundNumber(average(snapshots.map((item) => item.score)) ?? 0);
  const notes = [
    "테마 점수는 상대강도 50%, 거래대금 30%, 20일 모멘텀 20% 비중으로 계산합니다.",
    "뉴스 감성 점수는 아직 비활성 상태이며, 추후 sentimentScore 확장 포인트만 열어뒀습니다."
  ];

  if (snapshots.some((item) => item.note)) {
    notes.push("일부 테마는 구성 종목 응답 누락이 있어 부분 샘플 기준으로 계산했습니다.");
  }

  return {
    generatedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE),
    score,
    maxScore: 100,
    themeCount: snapshots.length,
    snapshots,
    history: snapshots,
    topThemes: snapshots.slice(0, 3),
    bottomThemes: [...snapshots].slice(-3).reverse(),
    notes,
    proxyMetrics
  };
}
