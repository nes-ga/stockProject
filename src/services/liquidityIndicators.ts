import { config } from "../config.js";
import { formatDateTimeInTimeZone, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { readJson } from "../lib/http.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type {
  LiquidityComparisonPoint,
  LiquidityIndicatorPoint,
  LiquidityIndicatorSnapshot,
  LiquidityIndicatorState,
  MarketLiquiditySnapshot
} from "../types.js";

type EcosStatisticSearchResponse = {
  StatisticSearch?: {
    list_total_count?: number;
    row?: Array<{
      TIME?: string;
      DATA_VALUE?: string;
    }>;
  };
  RESULT?: {
    CODE?: string;
    MESSAGE?: string;
  };
};

type EcosKeyStatisticResponse = {
  KeyStatisticList?: {
    row?: Array<{
      CLASS_NAME?: string;
      KEYSTAT_NAME?: string;
      DATA_VALUE?: string;
      CYCLE?: string;
      UNIT_NAME?: string;
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const logger = createLogger("liquidityIndicators");
const FRED_M2_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL";
const YAHOO_KOSDAQ_MONTHLY_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EKQ11?interval=1mo&range=max";
const ECOS_KOREA_M2_STAT_CODE = "161Y006";
const ECOS_KOREA_M2_ITEM_CODE = "BBHA00";
const ECOS_KOREA_M2_CYCLE = "M";
const ECOS_KOREA_M2_START_MONTH = "200001";
const ECOS_SAMPLE_PAGE_SIZE = 10;
const ECOS_AUTH_PAGE_SIZE = 1000;
const KOSDAQ_CHART_COUNT = 7000;
const LIQUIDITY_CACHE_TTL_MS = 30 * 60 * 1000;
const requestHeaders = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,text/csv,*/*",
  "Referer": "https://finance.naver.com/"
};

let cachedLiquidity:
  | {
      expiresAt: number;
      payload: MarketLiquiditySnapshot;
    }
  | undefined;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function parseFredM2Csv(csv: string): LiquidityIndicatorPoint[] {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, rawValue] = parseCsvLine(line);
      const value = Number(rawValue);
      return date && Number.isFinite(value) ? { date, value } : undefined;
    })
    .filter((point): point is LiquidityIndicatorPoint => Boolean(point))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function parseNaverChartXml(xml: string): LiquidityIndicatorPoint[] {
  const itemRegex = /<item[^>]+data="([^"]+)"/g;
  const points: LiquidityIndicatorPoint[] = [];

  for (const match of xml.matchAll(itemRegex)) {
    const [date, , , , close] = match[1].split("|");
    const value = Number(close);
    if (!date || !Number.isFinite(value)) {
      continue;
    }

    points.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      value
    });
  }

  return points.sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeEcosMonth(value: string) {
  return value.length === 6 ? `${value.slice(0, 4)}-${value.slice(4, 6)}` : value;
}

function formatUtcMonth(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseEcosM2Rows(rows: NonNullable<NonNullable<EcosStatisticSearchResponse["StatisticSearch"]>["row"]>): LiquidityIndicatorPoint[] {
  return rows
    .map((row) => {
      const value = Number(String(row.DATA_VALUE ?? "").replaceAll(",", ""));
      return row.TIME && Number.isFinite(value)
        ? {
            date: normalizeEcosMonth(row.TIME),
            value
          }
        : undefined;
    })
    .filter((point): point is LiquidityIndicatorPoint => Boolean(point))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function percentChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function roundMetric(value?: number, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function monthKeyToCompact(monthKey: string) {
  return monthKey.replace("-", "");
}

function shiftMonthKey(monthKey: string, offsetMonths: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aggregateMonthlyLast(points: LiquidityIndicatorPoint[]): LiquidityIndicatorPoint[] {
  const monthly = new Map<string, LiquidityIndicatorPoint>();

  for (const point of points) {
    const month = point.date.slice(0, 7);
    const existing = monthly.get(month);
    if (!existing || existing.date < point.date) {
      monthly.set(month, {
        date: month,
        value: point.value
      });
    }
  }

  return [...monthly.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function buildYoyMap(points: LiquidityIndicatorPoint[]) {
  const byDate = new Map(points.map((point) => [point.date.slice(0, 7), point.value]));
  const yoy = new Map<string, number>();

  for (const point of points) {
    const month = point.date.slice(0, 7);
    const previous = byDate.get(shiftMonthKey(month, -12));
    const change = roundMetric(percentChange(point.value, previous));
    if (change != null) {
      yoy.set(month, change);
    }
  }

  return yoy;
}

function classifyLiquidityState(params: { yoyPct?: number; change3mPct?: number }): LiquidityIndicatorState {
  const yoyPct = params.yoyPct;
  const change3mPct = params.change3mPct;

  if (yoyPct == null && change3mPct == null) {
    return "UNAVAILABLE";
  }
  if ((yoyPct ?? 0) < 0 || (change3mPct ?? 0) <= -1) {
    return "TIGHTENING";
  }
  if ((yoyPct ?? 0) >= 3 && (change3mPct ?? 0) > 0) {
    return "EXPANDING";
  }
  return "NEUTRAL";
}

function buildIndicator(params: {
  key: LiquidityIndicatorSnapshot["key"];
  label: string;
  source: string;
  unit: string;
  points: LiquidityIndicatorPoint[];
}): LiquidityIndicatorSnapshot {
  const points = params.points;
  const latest = points.at(-1);
  const previous1m = points.at(-2);
  const previous3m = points.at(-4);
  const previous6m = points.at(-7);
  const previous12m = points.at(-13);
  const change1mPct = roundMetric(percentChange(latest?.value, previous1m?.value));
  const change3mPct = roundMetric(percentChange(latest?.value, previous3m?.value));
  const change6mPct = roundMetric(percentChange(latest?.value, previous6m?.value));
  const yoyPct = roundMetric(percentChange(latest?.value, previous12m?.value));

  return {
    key: params.key,
    label: params.label,
    source: params.source,
    unit: params.unit,
    frequency: "monthly",
    latestDate: latest?.date,
    latestValue: latest?.value,
    change1mPct,
    change3mPct,
    change6mPct,
    yoyPct,
    state: classifyLiquidityState({
      yoyPct,
      change3mPct
    }),
    points
  };
}

function buildUnavailableIndicator(params: {
  key: LiquidityIndicatorSnapshot["key"];
  label: string;
  source: string;
  unit: string;
  error: string;
}): LiquidityIndicatorSnapshot {
  return {
    key: params.key,
    label: params.label,
    source: params.source,
    unit: params.unit,
    frequency: "monthly",
    state: "UNAVAILABLE",
    points: [],
    error: params.error
  };
}

async function fetchUsM2Indicator(): Promise<LiquidityIndicatorSnapshot> {
  const response = await fetch(FRED_M2_CSV_URL, {
    headers: requestHeaders
  });
  if (!response.ok) {
    throw new Error(`FRED M2 request failed with status ${response.status}`);
  }

  return buildIndicator({
    key: "US_M2",
    label: "글로벌 유동성",
    source: "FRED M2SL",
    unit: "십억 달러",
    points: parseFredM2Csv(await response.text())
  });
}

function shiftMonth(monthsAgo: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchEcosM2Page(params: {
  apiKey: string;
  startIndex: number;
  endIndex: number;
  startMonth: string;
  endMonth: string;
  statCode: string;
  itemCode: string;
  cycle: string;
}) {
  const url = new URL(
    `https://ecos.bok.or.kr/api/StatisticSearch/${params.apiKey}/json/kr/${params.startIndex}/${params.endIndex}/${params.statCode}/${params.cycle}/${params.startMonth}/${params.endMonth}/${params.itemCode}`
  );

  return fetch(url, { headers: requestHeaders }).then((response) => readJson<EcosStatisticSearchResponse>(response));
}

async function fetchKoreaM2PointsFromEcos() {
  const statCode = config.ecosKoreaM2StatCode ?? ECOS_KOREA_M2_STAT_CODE;
  const itemCode = config.ecosKoreaM2ItemCode ?? ECOS_KOREA_M2_ITEM_CODE;
  const cycle = config.ecosKoreaM2Cycle ?? ECOS_KOREA_M2_CYCLE;
  const endMonth = shiftMonth(0);
  const apiKey = config.ecosApiKey ?? "sample";
  const pageSize = config.ecosApiKey ? ECOS_AUTH_PAGE_SIZE : ECOS_SAMPLE_PAGE_SIZE;
  const firstPage = await fetchEcosM2Page({
    apiKey,
    startIndex: 1,
    endIndex: pageSize,
    startMonth: ECOS_KOREA_M2_START_MONTH,
    endMonth,
    statCode,
    itemCode,
    cycle
  });
  const firstRows = firstPage.StatisticSearch?.row ?? [];
  const totalCount = firstPage.StatisticSearch?.list_total_count ?? firstRows.length;

  if (!firstRows.length) {
    throw new Error(firstPage.RESULT?.MESSAGE ?? "ECOS M2 data is unavailable.");
  }

  const pageRanges = [];
  for (let startIndex = pageSize + 1; startIndex <= totalCount; startIndex += pageSize) {
    pageRanges.push({
      startIndex,
      endIndex: Math.min(startIndex + pageSize - 1, totalCount)
    });
  }

  const restPages = await Promise.all(
    pageRanges.map((range) =>
      fetchEcosM2Page({
        apiKey,
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        startMonth: ECOS_KOREA_M2_START_MONTH,
        endMonth,
        statCode,
        itemCode,
        cycle
      })
    )
  );
  const rows = [...firstRows, ...restPages.flatMap((page) => page.StatisticSearch?.row ?? [])];

  return {
    source: config.ecosApiKey ? "한국은행 ECOS M2(평잔, 원계열)" : "한국은행 ECOS M2(평잔, 원계열, sample)",
    points: parseEcosM2Rows(rows),
    cycle
  };
}

async function fetchKoreaM2Indicator(): Promise<LiquidityIndicatorSnapshot> {
  const ecosM2 = await fetchKoreaM2PointsFromEcos().catch(async (error) => {
    logger.warn("liquidity:ecos-m2-history-unavailable", toErrorContext(error));
    const fallback = await fetchKoreaM2LatestFromKeyStatistics();
    return {
      source: fallback.source,
      points: fallback.points,
      cycle: ECOS_KOREA_M2_CYCLE
    };
  });

  return buildIndicator({
    key: "KR_M2",
    label: "국내 유동성",
    source: ecosM2.source,
    unit: "십억원",
    points: ecosM2.points
  });
}

async function fetchKoreaM2LatestFromKeyStatistics(): Promise<LiquidityIndicatorSnapshot> {
  const pages = await Promise.all(
    Array.from({ length: 10 }, (_value, index) => {
      const start = index * 10 + 1;
      const end = start + 9;
      return fetch(`https://ecos.bok.or.kr/api/KeyStatisticList/sample/json/kr/${start}/${end}`).then((response) =>
        readJson<EcosKeyStatisticResponse>(response)
      );
    })
  );
  const rows = pages.flatMap((page) => page.KeyStatisticList?.row ?? []);
  const m2Row = rows.find((row) => row.CLASS_NAME === "통화량" && row.KEYSTAT_NAME === "M2(광의통화, 평잔)");
  const value = Number(String(m2Row?.DATA_VALUE ?? "").replaceAll(",", ""));

  if (!m2Row?.CYCLE || !Number.isFinite(value)) {
    return buildUnavailableIndicator({
      key: "KR_M2",
      label: "국내 유동성",
      source: "한국은행 ECOS 주요통계",
      unit: "십억원",
      error: "ECOS 주요통계에서 M2(광의통화, 평잔)를 찾지 못했습니다."
    });
  }

  const date = normalizeEcosMonth(m2Row.CYCLE);
  return {
    key: "KR_M2",
    label: "국내 유동성",
    source: "한국은행 ECOS 주요통계",
    unit: m2Row.UNIT_NAME ?? "십억원",
    frequency: "monthly",
    latestDate: date,
    latestValue: value,
    state: "NEUTRAL",
    points: [
      {
        date,
        value
      }
    ]
  };
}

async function fetchKosdaqMonthlyClosePoints(): Promise<LiquidityIndicatorPoint[]> {
  const yahooResponse = await fetch(YAHOO_KOSDAQ_MONTHLY_URL, { headers: requestHeaders }).catch((error) => {
    logger.warn("liquidity:yahoo-kosdaq-monthly-unavailable", toErrorContext(error));
    return undefined;
  });
  if (yahooResponse?.ok) {
    const payload = await readJson<YahooChartResponse>(yahooResponse);
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points = timestamps
      .map((timestamp, index) => {
        const value = closes[index];
        return value != null && Number.isFinite(value)
          ? {
              date: formatUtcMonth(timestamp),
              value
            }
          : undefined;
      })
      .filter((point): point is LiquidityIndicatorPoint => Boolean(point))
      .sort((left, right) => left.date.localeCompare(right.date));

    if (points.length) {
      return points;
    }
  }

  const url = new URL("https://fchart.stock.naver.com/sise.nhn");
  url.searchParams.set("symbol", "KOSDAQ");
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(KOSDAQ_CHART_COUNT));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) {
    throw new Error(`Naver KOSDAQ chart request failed with status ${response.status}`);
  }

  return aggregateMonthlyLast(parseNaverChartXml(await response.text()));
}

function buildAlignedLiquidityComparison(params: {
  usM2Points: LiquidityIndicatorPoint[];
  krM2Points: LiquidityIndicatorPoint[];
  kosdaqPoints: LiquidityIndicatorPoint[];
}): MarketLiquiditySnapshot["comparison"] | undefined {
  const usYoy = buildYoyMap(params.usM2Points);
  const krYoy = buildYoyMap(params.krM2Points);
  const kosdaqYoy = buildYoyMap(params.kosdaqPoints);
  const dates = [...krYoy.keys()]
    .filter((date) => usYoy.has(date) && kosdaqYoy.has(date))
    .sort((left, right) => left.localeCompare(right));
  const points: LiquidityComparisonPoint[] = dates.map((date) => ({
    date,
    usM2YoyPct: usYoy.get(date) ?? 0,
    krM2YoyPct: krYoy.get(date) ?? 0,
    kosdaqYoyPct: kosdaqYoy.get(date) ?? 0
  }));

  const first = points[0];
  const latest = points.at(-1);
  if (!first || !latest) {
    return undefined;
  }

  return {
    startDate: first.date,
    endDate: latest.date,
    pointCount: points.length,
    points,
    source: "FRED M2SL · 한국은행 ECOS 161Y006/BBHA00 · 네이버 KOSDAQ 월말 종가"
  };
}

export async function getMarketLiquiditySnapshot(options?: { forceRefresh?: boolean }): Promise<MarketLiquiditySnapshot> {
  if (!options?.forceRefresh && cachedLiquidity && cachedLiquidity.expiresAt > Date.now()) {
    return cachedLiquidity.payload;
  }

  const [usResult, koreaResult, kosdaqResult] = await Promise.allSettled([
    fetchUsM2Indicator(),
    fetchKoreaM2Indicator(),
    fetchKosdaqMonthlyClosePoints()
  ]);
  const usIndicator =
    usResult.status === "fulfilled"
      ? usResult.value
      : buildUnavailableIndicator({
          key: "US_M2",
          label: "글로벌 유동성",
          source: "FRED M2SL",
          unit: "십억 달러",
          error: usResult.reason instanceof Error ? usResult.reason.message : "FRED M2 data is unavailable."
        });
  const koreaIndicator =
    koreaResult.status === "fulfilled"
      ? koreaResult.value
      : buildUnavailableIndicator({
          key: "KR_M2",
          label: "국내 유동성",
          source: "한국은행 ECOS",
          unit: "ECOS 원자료",
          error: koreaResult.reason instanceof Error ? koreaResult.reason.message : "ECOS M2 data is unavailable."
        });
  const comparison =
    usResult.status === "fulfilled" && koreaResult.status === "fulfilled" && kosdaqResult.status === "fulfilled"
      ? buildAlignedLiquidityComparison({
          usM2Points: usResult.value.points,
          krM2Points: koreaResult.value.points,
          kosdaqPoints: kosdaqResult.value
        })
      : undefined;
  const notes = [usIndicator, koreaIndicator]
    .filter((indicator) => indicator.error)
    .map((indicator) => `${indicator.label}: ${indicator.error}`);
  if (kosdaqResult.status === "rejected") {
    notes.push(`KOSDAQ: ${kosdaqResult.reason instanceof Error ? kosdaqResult.reason.message : "KOSDAQ monthly data is unavailable."}`);
  }
  if (!comparison) {
    notes.push("M2 YoY와 KOSDAQ YoY를 같은 월로 정렬할 수 있는 데이터가 충분하지 않습니다.");
  }
  const payload = {
    generatedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE),
    indicators: [usIndicator, koreaIndicator],
    comparison,
    notes
  };

  cachedLiquidity = {
    expiresAt: Date.now() + LIQUIDITY_CACHE_TTL_MS,
    payload
  };

  logger.info("liquidity:ready", {
    indicators: payload.indicators.length,
    comparisonPoints: payload.comparison?.pointCount ?? 0,
    errors: payload.indicators.filter((indicator) => indicator.error).length
  });
  if (notes.length) {
    logger.warn("liquidity:partial", {
      notes,
      ...toErrorContext(new Error(notes.join(" | ")))
    });
  }

  return payload;
}
