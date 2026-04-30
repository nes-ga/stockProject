import { getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { createLogger } from "../lib/logger.js";
import { readJson } from "../lib/http.js";
import type {
  ChartPoint,
  MarketFlowGlobalSnapshot,
  MarketFlowGlobalState,
  MarketFlowLocalSnapshot,
  MarketFlowLocalState,
  MarketFlowSignal,
  MarketWatchSnapshot
} from "../types.js";
import type { ThemeRotationProxyMetrics } from "./themeRotationEngine.js";

const logger = createLogger("marketCycleEngine");
const naverRequestHeaders = {
  "User-Agent": "Mozilla/5.0",
  "Referer": "https://finance.naver.com/"
};
const yahooRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/"
};

type YahooChartResponse = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        exchangeTimezoneName?: string;
      };
      indicators: {
        quote: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type LocalMarketInternals = {
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
  notes: string[];
};

function average(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function scaleScore(score: number, maxScore: number, targetMaxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return roundNumber((score / maxScore) * targetMaxScore, 2);
}

function getAverageClose(points: ChartPoint[], period: number) {
  if (points.length < period) {
    return undefined;
  }

  return average(points.slice(-period).map((point) => point.close));
}

function isAboveSma(points: ChartPoint[], period: number) {
  const latest = points.at(-1)?.close;
  const sma = getAverageClose(points, period);
  if (latest == null || sma == null) {
    return undefined;
  }

  return latest > sma;
}

function stripTags(html: string) {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseNumberText(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: naverRequestHeaders
  });
  if (!response.ok) {
    throw new Error(`Market internals request failed with status ${response.status}`);
  }

  return response.text();
}

function parseBreadthFromIndexPage(html: string) {
  const advancingCount = parseNumberText(html.match(/상승종목수<\/span><a[^>]*><span>([\d,]+)<\/span>/)?.[1] ?? "");
  const decliningCount = parseNumberText(html.match(/하락종목수<\/span><a[^>]*><span>([\d,]+)<\/span>/)?.[1] ?? "");
  if (advancingCount == null || decliningCount == null) {
    return undefined;
  }

  const denominator = Math.max(1, advancingCount + decliningCount);
  return {
    advancingCount,
    decliningCount,
    advancingPercent: roundNumber((advancingCount / denominator) * 100)
  };
}

function parseIndexDayRows(html: string) {
  const tableMatch = html.match(/<table[^>]+summary="일별 시세표:[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return [];
  }

  const rows = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const parsed: Array<{ date: string; amount?: number }> = [];

  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    if (cells.length < 5) {
      continue;
    }

    const dateCell = cells[0];
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(dateCell)) {
      continue;
    }

    parsed.push({
      date: dateCell.replaceAll(".", "-"),
      amount: parseNumberText(cells[4])
    });
  }

  return parsed;
}

function buildYahooChartPoints(chartPayload: YahooChartResponse): ChartPoint[] {
  const result = chartPayload.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  const timestamps = result?.timestamp ?? [];
  const points: ChartPoint[] = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const close = quote?.close?.[index];
    if (close == null) {
      continue;
    }

    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    points.push({
      date,
      open: quote?.open?.[index] ?? undefined,
      high: quote?.high?.[index] ?? undefined,
      low: quote?.low?.[index] ?? undefined,
      close,
      volume: quote?.volume?.[index] ?? undefined
    });
  }

  return points;
}

async function fetchYahooDailyPoints(symbol: string, range = "6mo") {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  chartUrl.searchParams.set("interval", "1d");
  chartUrl.searchParams.set("range", range);
  const payload = await fetch(chartUrl, {
    headers: yahooRequestHeaders
  }).then((response) => readJson<YahooChartResponse>(response));

  return buildYahooChartPoints(payload);
}

async function fetchIndexTurnoverSeries(code: "KOSPI" | "KOSDAQ", neededRows = 20) {
  const rows: Array<{ date: string; amount?: number }> = [];

  for (let page = 1; page <= 4 && rows.length < neededRows; page += 1) {
    const html = await fetchHtml(`https://finance.naver.com/sise/sise_index_day.naver?code=${code}&page=${page}`);
    rows.push(...parseIndexDayRows(html));
  }

  return rows.slice(0, neededRows);
}

async function fetchLocalMarketInternals(): Promise<LocalMarketInternals> {
  const notes: string[] = [];

  try {
    const [kospiPage, kosdaqPage, kospiTurnoverRows, kosdaqTurnoverRows] = await Promise.all([
      fetchHtml("https://finance.naver.com/sise/sise_index.naver?code=KOSPI"),
      fetchHtml("https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ"),
      fetchIndexTurnoverSeries("KOSPI"),
      fetchIndexTurnoverSeries("KOSDAQ")
    ]);

    const kospiBreadth = parseBreadthFromIndexPage(kospiPage);
    const kosdaqBreadth = parseBreadthFromIndexPage(kosdaqPage);
    const advancingCount = (kospiBreadth?.advancingCount ?? 0) + (kosdaqBreadth?.advancingCount ?? 0);
    const decliningCount = (kospiBreadth?.decliningCount ?? 0) + (kosdaqBreadth?.decliningCount ?? 0);
    const breadth =
      advancingCount > 0 || decliningCount > 0
        ? {
            source: "naver-index-pages",
            advancingCount,
            decliningCount,
            advancingPercent: roundNumber((advancingCount / Math.max(1, advancingCount + decliningCount)) * 100)
          }
        : undefined;

    const turnoverSeries = [...kospiTurnoverRows, ...kosdaqTurnoverRows].filter(
      (row): row is { date: string; amount: number } => typeof row.amount === "number"
    );
    const turnoverCurrent =
      (kospiTurnoverRows[0]?.amount ?? 0) + (kosdaqTurnoverRows[0]?.amount ?? 0);
    const turnoverAverage20 =
      (average(kospiTurnoverRows.map((row) => row.amount).filter((value): value is number => typeof value === "number")) ?? 0) +
      (average(kosdaqTurnoverRows.map((row) => row.amount).filter((value): value is number => typeof value === "number")) ?? 0);
    const turnover =
      turnoverCurrent > 0 && turnoverAverage20 > 0
        ? {
            source: "naver-index-day-pages",
            current: turnoverCurrent * 1_000_000,
            average20: turnoverAverage20 * 1_000_000,
            ratio: roundNumber(turnoverCurrent / turnoverAverage20, 3)
          }
        : undefined;

    if (!breadth) {
      notes.push("국내 breadth를 직접 파싱하지 못해 breadth 신호를 생략했습니다.");
    }
    if (!turnover) {
      notes.push("국내 거래대금 평균을 직접 파싱하지 못해 turnover 신호를 생략했습니다.");
    }

    return {
      breadth,
      turnover,
      notes
    };
  } catch (error) {
    logger.warn("local-market-internals:failed", {
      message: error instanceof Error ? error.message : "Failed to load local market internals."
    });
    return {
      notes: ["국내 breadth/turnover 페이지를 읽지 못해 프록시 지표가 있으면 그것을 사용합니다."]
    };
  }
}

function resolveGlobalState(normalizedScore: number): MarketFlowGlobalState {
  if (normalizedScore >= 3) {
    return "RISK_ON";
  }
  if (normalizedScore >= 1) {
    return "NEUTRAL";
  }
  return "RISK_OFF";
}

function resolveLocalState(normalizedScore: number): MarketFlowLocalState {
  if (normalizedScore >= 5) {
    return "STRONG";
  }
  if (normalizedScore >= 3) {
    return "SELECTIVE";
  }
  if (normalizedScore >= 1) {
    return "WEAK";
  }
  return "DEFENSIVE";
}

function createBinarySignal(params: {
  key: string;
  label: string;
  passed: boolean | undefined;
  value?: number | string;
  reference?: number | string;
  note?: string;
  isProxy?: boolean;
}): MarketFlowSignal | null {
  if (params.passed == null) {
    return null;
  }

  return {
    key: params.key,
    label: params.label,
    passed: params.passed,
    score: params.passed ? 1 : 0,
    maxScore: 1,
    value: params.value,
    reference: params.reference,
    note: params.note,
    isProxy: params.isProxy
  };
}

export async function getGlobalCycleSnapshot(params: {
  marketWatchItems: Map<string, MarketWatchSnapshot>;
}): Promise<MarketFlowGlobalSnapshot> {
  const [sp500Points, nasdaqPoints, us10yPoints] = await Promise.all([
    fetchYahooDailyPoints("^GSPC", "6mo"),
    fetchYahooDailyPoints("^IXIC", "6mo"),
    fetchYahooDailyPoints("^TNX", "6mo")
  ]);
  const usdkrwPoints = params.marketWatchItems.get("USDKRW")?.chartSets?.daily?.points ?? [];
  const notes: string[] = [];

  const signals = [
    createBinarySignal({
      key: "sp500_above_sma60",
      label: "S&P500 60일선 상단",
      passed: isAboveSma(sp500Points, 60),
      value: sp500Points.at(-1)?.close,
      reference: getAverageClose(sp500Points, 60)
    }),
    createBinarySignal({
      key: "nasdaq_above_sma60",
      label: "NASDAQ 60일선 상단",
      passed: isAboveSma(nasdaqPoints, 60),
      value: nasdaqPoints.at(-1)?.close,
      reference: getAverageClose(nasdaqPoints, 60)
    }),
    createBinarySignal({
      key: "us10y_falling",
      label: "미국 10년물 금리 하락 추세",
      passed: (() => {
        const latest = us10yPoints.at(-1)?.close;
        const sma20 = getAverageClose(us10yPoints, 20);
        const change20d = percentChange(latest, us10yPoints.at(-21)?.close);
        if (latest == null || sma20 == null || change20d == null) {
          return undefined;
        }
        return latest < sma20 || change20d < 0;
      })(),
      value: us10yPoints.at(-1)?.close,
      reference: getAverageClose(us10yPoints, 20)
    }),
    createBinarySignal({
      key: "usdkrw_weak_usd",
      label: "달러 약세 / 원화 강세",
      passed: (() => {
        const latest = usdkrwPoints.at(-1)?.close;
        const sma20 = getAverageClose(usdkrwPoints, 20);
        const change20d = percentChange(latest, usdkrwPoints.at(-21)?.close);
        if (latest == null || sma20 == null || change20d == null) {
          return undefined;
        }
        return latest < sma20 || change20d < 0;
      })(),
      value: usdkrwPoints.at(-1)?.close,
      reference: getAverageClose(usdkrwPoints, 20),
      note: "USD/KRW 기준으로 달러 강약을 판정합니다."
    })
  ].filter((item): item is MarketFlowSignal => Boolean(item));

  if (signals.length < 4) {
    notes.push("일부 글로벌 보조 지표가 비어 있어 가용 신호만으로 점수를 정규화했습니다.");
  }

  const score = signals.reduce((sum, signal) => sum + signal.score, 0);
  const maxScore = signals.reduce((sum, signal) => sum + signal.maxScore, 0);
  const normalizedScore = scaleScore(score, maxScore, 4);

  return {
    date: getCurrentIsoDate(SEOUL_TIME_ZONE),
    score,
    maxScore,
    normalizedScore,
    state: resolveGlobalState(normalizedScore),
    signals,
    notes
  };
}

export async function getLocalCycleSnapshot(params: {
  marketWatchItems: Map<string, MarketWatchSnapshot>;
  proxyMetrics?: ThemeRotationProxyMetrics;
}): Promise<MarketFlowLocalSnapshot> {
  const date = getCurrentIsoDate(SEOUL_TIME_ZONE);
  const kospiPoints = params.marketWatchItems.get("KOSPI")?.chartSets?.daily?.points ?? [];
  const kosdaqPoints = params.marketWatchItems.get("KOSDAQ")?.chartSets?.daily?.points ?? [];
  const marketInternals = await fetchLocalMarketInternals();
  const notes = [...marketInternals.notes];
  const breadth = marketInternals.breadth ?? params.proxyMetrics?.breadth;
  const turnover = marketInternals.turnover ?? params.proxyMetrics?.turnover;
  const breadthUsedProxy = marketInternals.breadth == null && breadth != null;
  const turnoverUsedProxy = marketInternals.turnover == null && turnover != null;

  if (breadthUsedProxy) {
    notes.push("상승/하락 종목수는 추적 중인 테마 유니버스를 프록시로 사용했습니다.");
  }
  if (turnoverUsedProxy) {
    notes.push("거래대금 비교는 추적 중인 테마 유니버스의 합산 거래대금을 프록시로 사용했습니다.");
  }
  notes.push("외국인/기관 5일 누적 순매수는 현재 프로젝트 데이터 소스가 없어 optional 신호로 남겨뒀습니다.");

  const signals = [
    createBinarySignal({
      key: "kospi_above_sma60",
      label: "KOSPI 60일선 상단",
      passed: isAboveSma(kospiPoints, 60),
      value: kospiPoints.at(-1)?.close,
      reference: getAverageClose(kospiPoints, 60)
    }),
    createBinarySignal({
      key: "kosdaq_above_sma60",
      label: "KOSDAQ 60일선 상단",
      passed: isAboveSma(kosdaqPoints, 60),
      value: kosdaqPoints.at(-1)?.close,
      reference: getAverageClose(kosdaqPoints, 60)
    }),
    createBinarySignal({
      key: "turnover_above_20d_avg",
      label: "전체 거래대금 20일 평균 이상",
      passed: turnover?.ratio != null ? turnover.ratio >= 1 : undefined,
      value: turnover?.ratio,
      reference: 1,
      note: turnover?.source,
      isProxy: turnoverUsedProxy
    }),
    createBinarySignal({
      key: "advancing_ratio_above_55",
      label: "상승 종목 비율 55% 이상",
      passed: breadth?.advancingPercent != null ? breadth.advancingPercent >= 55 : undefined,
      value: breadth?.advancingPercent,
      reference: 55,
      note: breadth?.source,
      isProxy: breadthUsedProxy
    })
  ].filter((item): item is MarketFlowSignal => Boolean(item));

  const score = signals.reduce((sum, signal) => sum + signal.score, 0);
  const maxScore = signals.reduce((sum, signal) => sum + signal.maxScore, 0);
  const normalizedScore = scaleScore(score, maxScore, 6);

  return {
    date,
    score,
    maxScore,
    normalizedScore,
    state: resolveLocalState(normalizedScore),
    signals,
    breadth,
    turnover,
    investorFlows: {
      source: "unavailable"
    },
    notes
  };
}
