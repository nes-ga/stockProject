import { config } from "../config.js";
import { readJson } from "../lib/http.js";
import type { ChartPoint, RecommendationAnalysis, RecommendationRequest, StockAnalysis } from "../types.js";
import { fetchFundamentals } from "./fundamentals.js";
import { resolveFinanceSymbol } from "./symbolExtractor.js";

type QuoteResponse = {
  quoteResponse: {
    result: Array<{
      symbol: string;
      currency?: string;
      fullExchangeName?: string;
      shortName?: string;
      regularMarketPrice?: number;
      regularMarketPreviousClose?: number;
    }>;
  };
};

type ChartResponse = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        currency?: string;
        exchangeName?: string;
        shortName?: string;
        regularMarketPrice?: number;
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

type QuoteSummary = {
  currency?: string;
  exchangeName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
};

function isKoreanNumericSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

function toNaverSymbol(symbol: string): string | undefined {
  const numeric = symbol.match(/\d{6}/)?.[0];
  return numeric && /^\d{6}$/.test(numeric) ? numeric : undefined;
}

function average(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateRsi(closes: number[], period = 14): number | undefined {
  if (closes.length <= period) {
    return undefined;
  }

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i += 1) {
    const previous = closes[i - 1];
    const current = closes[i];
    const change = current - previous;
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function percentChange(current: number, previous?: number): number | undefined {
  if (!previous || previous === 0) {
    return undefined;
  }
  return ((current - previous) / previous) * 100;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function averageDefined(values: Array<number | undefined>, count?: number): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (count != null) {
    return average(filtered.slice(-count));
  }
  return average(filtered);
}

function ratio(value?: number, base?: number): number | undefined {
  if (value == null || base == null || base === 0) {
    return undefined;
  }
  return value / base;
}

function buildChartPoints(chartPayload: ChartResponse): ChartPoint[] {
  const result = chartPayload.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  const timestamps = result?.timestamp ?? [];
  const points: ChartPoint[] = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const close = quote?.close?.[index];
    if (close == null) {
      continue;
    }

    points.push({
        date: toIsoDate(new Date(timestamp * 1000)),
        open: quote?.open?.[index] ?? undefined,
        high: quote?.high?.[index] ?? undefined,
        low: quote?.low?.[index] ?? undefined,
        close,
        volume: quote?.volume?.[index] ?? undefined
    });
  }

  return points;
}

function parseNaverChartXml(xml: string): ChartPoint[] {
  const itemRegex = /<item[^>]+data="([^"]+)"/g;
  const points: ChartPoint[] = [];

  for (const match of xml.matchAll(itemRegex)) {
    const raw = match[1];
    const [date, open, high, low, close, volume] = raw.split("|");
    if (!date || !close) {
      continue;
    }

    points.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume ? Number(volume) : undefined
    });
  }

  return points;
}

async function fetchNaverChart(symbol: string, count = 500) {
  const naverSymbol = toNaverSymbol(symbol);
  if (!naverSymbol) {
    throw new Error(`Unsupported Naver symbol: ${symbol}`);
  }

  const url = new URL("https://fchart.stock.naver.com/sise.nhn");
  url.searchParams.set("symbol", naverSymbol);
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(count));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://finance.naver.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Naver chart request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const points = parseNaverChartXml(xml);
  if (!points.length) {
    throw new Error(`No Naver chart data available for ${symbol}`);
  }

  const latestPoint = points.at(-1);
  const previousPoint = points.at(-2);

  return {
    quote: {
      currency: "KRW",
      exchangeName: "NAVER_FINANCE",
      shortName: naverSymbol,
      regularMarketPrice: latestPoint?.close,
      regularMarketPreviousClose: previousPoint?.close
    } satisfies QuoteSummary,
    chartPayload: undefined,
    points
  };
}

async function fetchQuoteAndChart(symbol: string, chartOptions?: { period1?: string; range?: string }) {
  if (isKoreanNumericSymbol(symbol) || /\.K[QS]$/.test(symbol)) {
    return fetchNaverChart(symbol);
  }

  const quoteUrl = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  quoteUrl.searchParams.set("symbols", symbol);

  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  chartUrl.searchParams.set("interval", "1d");
  if (chartOptions?.period1) {
    chartUrl.searchParams.set("period1", String(Math.floor(Date.parse(`${chartOptions.period1}T00:00:00Z`) / 1000)));
    chartUrl.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
  } else {
    chartUrl.searchParams.set("range", chartOptions?.range ?? "3mo");
  }

  const requestHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/"
  };

  const [quotePayload, chartPayload] = await Promise.all([
    fetch(quoteUrl, { headers: requestHeaders }).then((response) => readJson<QuoteResponse>(response)),
    fetch(chartUrl, { headers: requestHeaders }).then((response) => readJson<ChartResponse>(response))
  ]);

  const yahooQuote = quotePayload.quoteResponse.result[0];
  const quote: QuoteSummary | undefined = yahooQuote
    ? {
        currency: yahooQuote.currency,
        exchangeName: yahooQuote.fullExchangeName,
        shortName: yahooQuote.shortName,
        regularMarketPrice: yahooQuote.regularMarketPrice,
        regularMarketPreviousClose: yahooQuote.regularMarketPreviousClose
      }
    : undefined;

  return {
    quote,
    chartPayload,
    points: buildChartPoints(chartPayload)
  };
}

function describeTrend(params: {
  price: number;
  sma5?: number;
  sma20?: number;
  rsi14?: number;
}): Pick<StockAnalysis, "trend" | "summary"> {
  const { price, sma5, sma20, rsi14 } = params;

  if (sma5 && sma20 && price > sma5 && sma5 > sma20) {
    if (rsi14 && rsi14 >= 70) {
      return {
        trend: "bullish",
        summary: "상승 추세지만 RSI가 높아 단기 과열 가능성이 있습니다."
      };
    }
    return {
      trend: "bullish",
      summary: "단기 평균이 중기 평균보다 높고 가격도 그 위에 있어 상승 흐름으로 해석됩니다."
    };
  }

  if (sma5 && sma20 && price < sma5 && sma5 < sma20) {
    if (rsi14 && rsi14 <= 30) {
      return {
        trend: "bearish",
        summary: "하락 추세이며 RSI가 낮아 단기 반등 가능성도 함께 봐야 합니다."
      };
    }
    return {
      trend: "bearish",
      summary: "단기 평균이 중기 평균 아래에 있어 약세 흐름으로 해석됩니다."
    };
  }

  return {
    trend: "neutral",
    summary: "이동평균과 가격 위치가 엇갈려 있어 방향성이 뚜렷하지 않습니다."
  };
}

export async function analyzeSymbol(rawSymbol: string): Promise<StockAnalysis> {
  const symbol = resolveFinanceSymbol(rawSymbol, config.yahooDefaultMarketSuffix);
  const { quote, points } = await fetchQuoteAndChart(symbol, { range: "3mo" });
  const closes = points.map((point) => point.close);

  if (!quote || !closes?.length || typeof quote.regularMarketPrice !== "number") {
    throw new Error(`No price data available for ${symbol}`);
  }

  const latestPrice = quote.regularMarketPrice;
  const sma5 = average(closes.slice(-5));
  const sma20 = average(closes.slice(-20));
  const rsi14 = calculateRsi(closes, 14);
  const twentyDaysAgo = closes.length > 20 ? closes[closes.length - 21] : closes[0];
  const trendInfo = describeTrend({
    price: latestPrice,
    sma5,
    sma20,
    rsi14
  });

  return {
    symbol: rawSymbol.toUpperCase(),
    resolvedSymbol: symbol,
    currency: quote.currency,
    exchangeName: quote.exchangeName,
    shortName: quote.shortName,
    price: latestPrice,
    previousClose: quote.regularMarketPreviousClose,
    changePercent1d: percentChange(latestPrice, quote.regularMarketPreviousClose),
    changePercent20d: percentChange(latestPrice, twentyDaysAgo),
    sma5,
    sma20,
    rsi14,
    ...trendInfo
  };
}

export async function analyzeSymbols(symbols: string[]) {
  return Promise.all(symbols.map((symbol) => analyzeSymbol(symbol)));
}

function getQuoteSummary(quote: QuoteSummary | undefined, points: ChartPoint[]) {
  const latestPoint = points.at(-1);
  return {
    currency: quote?.currency,
    exchangeName: quote?.exchangeName,
    shortName: quote?.shortName,
    latestClose: quote?.regularMarketPrice ?? latestPoint?.close
  };
}

export async function analyzeRecommendation(input: RecommendationRequest): Promise<RecommendationAnalysis> {
  const symbol = resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix);
  const period1 = addDays(input.anchorDate, -40);
  const [chartResult, fundamentals] = await Promise.all([
    fetchQuoteAndChart(symbol, { period1 }),
    fetchFundamentals(input.symbol)
  ]);
  const { quote, points } = chartResult;

  if (!points.length) {
    throw new Error(`No chart data available for ${symbol}`);
  }

  const anchorIndex = points.findIndex((point) => point.date >= input.anchorDate);
  if (anchorIndex === -1) {
    throw new Error(`No trading session found on or after ${input.anchorDate} for ${symbol}`);
  }

  const anchorPoint = points[anchorIndex];
  const latestPoint = points.at(-1);
  if (!latestPoint) {
    throw new Error(`No latest chart point available for ${symbol}`);
  }

  const afterAnchorPoints = points.slice(anchorIndex);
  const closesAfterAnchor = afterAnchorPoints.map((point) => point.close);
  const volumesBeforeAnchor = points.slice(Math.max(0, anchorIndex - 20), anchorIndex).map((point) => point.volume);
  const volumesAfterAnchor = afterAnchorPoints.slice(0, 20).map((point) => point.volume);
  const volumesLatest = points.slice(-20).map((point) => point.volume);

  let highestPoint = anchorPoint;
  let lowestPoint = anchorPoint;
  for (const point of afterAnchorPoints) {
    if (point.close > highestPoint.close) {
      highestPoint = point;
    }
    if (point.close < lowestPoint.close) {
      lowestPoint = point;
    }
  }

  const summary = getQuoteSummary(quote, points);
  const avgVolume20Before = averageDefined(volumesBeforeAnchor);
  const avgVolume20After = averageDefined(volumesAfterAnchor);
  const avgVolume20Latest = averageDefined(volumesLatest);

  return {
    name: input.name,
    symbol: input.symbol,
    resolvedSymbol: symbol,
    anchorDate: input.anchorDate,
    tradingAnchorDate: anchorPoint.date,
    latestMentionDate: input.latestMentionDate,
    note: input.note,
    currency: summary.currency,
    exchangeName: summary.exchangeName,
    shortName: summary.shortName,
    anchorClose: anchorPoint.close,
    latestClose: latestPoint.close,
    latestDate: latestPoint.date,
    returnSinceAnchor: percentChange(latestPoint.close, anchorPoint.close) ?? 0,
    maxGainPercent: percentChange(highestPoint.close, anchorPoint.close) ?? 0,
    maxDrawdownPercent: percentChange(lowestPoint.close, anchorPoint.close) ?? 0,
    highestClose: {
      date: highestPoint.date,
      close: highestPoint.close
    },
    lowestClose: {
      date: lowestPoint.date,
      close: lowestPoint.close
    },
    anchorVolume: anchorPoint.volume,
    avgVolume20Before,
    avgVolume20After,
    avgVolume20Latest,
    anchorVolumeVs20dBefore: ratio(anchorPoint.volume, avgVolume20Before),
    latestVolume: latestPoint.volume,
    latestVolumeVs20d: ratio(latestPoint.volume, avgVolume20Latest),
    chartWindow: {
      startDate: points[0].date,
      endDate: latestPoint.date,
      points
    },
    fundamentals
  };
}

export async function analyzeRecommendations(inputs: RecommendationRequest[]) {
  return Promise.all(inputs.map((input) => analyzeRecommendation(input)));
}
