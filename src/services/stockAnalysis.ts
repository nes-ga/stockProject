import { config } from "../config.js";
import { readJson } from "../lib/http.js";
import type {
  ChartPoint,
  RecommendationAnalysis,
  RecommendationPatternAnalysis,
  RecommendationPatternFilters,
  RecommendationPatternMatch,
  RecommendationRequest,
  SmartMoneyPatternAnalysis,
  SmartMoneyCandidateSummary,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyPatternRequest,
  SmartMoneyMarketContext,
  SmartMoneyPullbackType,
  SmartMoneyRejectReason,
  StockAnalysis
} from "../types.js";
import { fetchFundamentals } from "./fundamentals.js";
import { evaluateSmartMoneyPattern, resolveSmartMoneyPatternFilters } from "./smartMoneyEngine.js";
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
    summary: "이동평균과 가격 위치가 엇갈려 있어 방향성이 선명하지 않습니다."
  };
}

export async function analyzeSymbol(rawSymbol: string): Promise<StockAnalysis> {
  const symbol = resolveFinanceSymbol(rawSymbol, config.yahooDefaultMarketSuffix);
  const { quote, points } = await fetchQuoteAndChart(symbol, { range: "3mo" });
  const closes = points.map((point) => point.close);

  if (!quote || !closes.length || typeof quote.regularMarketPrice !== "number") {
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

const defaultRecommendationPatternFilters: RecommendationPatternFilters = {
  lookbackTradingDays: 10,
  minPriceChangePercent: 7,
  minVolumeRatio: 3,
  minSignalScore: 50,
  breakoutWindowDays: 20,
  requireBreakout: false,
  closeNearHighRatio: 0.985
};

const defaultSmartMoneyPatternFilters: SmartMoneyPatternFilters = resolveSmartMoneyPatternFilters();

function averageNumberSeries(values: Array<number | undefined>): number | undefined {
  return average(values.filter((value): value is number => typeof value === "number"));
}

function getAverageVolumeBefore(points: ChartPoint[], index: number, period = 20): number | undefined {
  return averageNumberSeries(points.slice(Math.max(0, index - period), index).map((point) => point.volume));
}

function getHighestCloseBefore(points: ChartPoint[], index: number, period: number): number | undefined {
  const closes = points.slice(Math.max(0, index - period), index).map((point) => point.close);
  return closes.length ? Math.max(...closes) : undefined;
}

function toSignal(score: number): SmartMoneyPatternMatch["signal"] {
  if (score >= 85) {
    return "explosive";
  }
  if (score >= 65) {
    return "strong";
  }
  return "watch";
}

function buildEmptyPattern(windowPoints: ChartPoint[]): RecommendationPatternMatch {
  return {
    matched: false,
    windowStartDate: windowPoints[0]?.date,
    windowEndDate: windowPoints.at(-1)?.date,
    signalDate: undefined,
    signalScore: 0,
    signal: "watch",
    sessionsBeforeAnchor: undefined,
    close: undefined,
    previousClose: undefined,
    priceChangePercent: undefined,
    volume: undefined,
    avgVolume20: undefined,
    volumeRatio20d: undefined,
    breakout10d: false,
    breakout20d: false,
    closedNearHigh: false,
    reasons: ["No qualifying momentum signal was found in the pre-anchor window."],
    summary: "No qualifying momentum signal was found in the pre-anchor window."
  };
}

function evaluatePreAnchorMomentumWindow(
  points: ChartPoint[],
  anchorIndex: number,
  filters: RecommendationPatternFilters
): RecommendationPatternMatch {
  const windowStartIndex = Math.max(0, anchorIndex - filters.lookbackTradingDays);
  const windowPoints = points.slice(windowStartIndex, anchorIndex);

  if (!windowPoints.length) {
    return buildEmptyPattern(windowPoints);
  }

  let bestMatch = buildEmptyPattern(windowPoints);

  for (let index = windowStartIndex; index < anchorIndex; index += 1) {
    const point = points[index];
    const previousPoint = points[index - 1];
    if (!point || !previousPoint) {
      continue;
    }

    const trailingVolumes20 = points
      .slice(Math.max(0, index - 20), index)
      .map((candidate) => candidate.volume);
    const avgVolume20 = averageNumberSeries(trailingVolumes20);
    const volumeRatio20d = ratio(point.volume, avgVolume20);

    const trailingCloses10 = points.slice(Math.max(0, index - 10), index).map((candidate) => candidate.close);
    const trailingCloses20 = points.slice(Math.max(0, index - 20), index).map((candidate) => candidate.close);
    const highestClose10 = trailingCloses10.length ? Math.max(...trailingCloses10) : undefined;
    const highestClose20 = trailingCloses20.length ? Math.max(...trailingCloses20) : undefined;
    const breakout10d = highestClose10 != null ? point.close >= highestClose10 : false;
    const breakout20d = highestClose20 != null ? point.close >= highestClose20 : false;
    const closedNearHigh = point.high != null ? point.close >= point.high * filters.closeNearHighRatio : false;
    const priceChangePercent = percentChange(point.close, previousPoint.close);

    let signalScore = 0;
    const reasons: string[] = [];

    if (priceChangePercent != null && priceChangePercent >= 20) {
      signalScore += 35;
      reasons.push(`Price rose ${priceChangePercent.toFixed(1)}% in one session.`);
    } else if (priceChangePercent != null && priceChangePercent >= 12) {
      signalScore += 25;
      reasons.push(`Price rose ${priceChangePercent.toFixed(1)}% in one session.`);
    } else if (priceChangePercent != null && priceChangePercent >= filters.minPriceChangePercent) {
      signalScore += 15;
      reasons.push(`Price rose ${priceChangePercent.toFixed(1)}% in one session.`);
    }

    if (volumeRatio20d != null && volumeRatio20d >= Math.max(filters.minVolumeRatio, 6)) {
      signalScore += 35;
      reasons.push(`Volume reached ${volumeRatio20d.toFixed(1)}x the 20-day average.`);
    } else if (volumeRatio20d != null && volumeRatio20d >= Math.max(filters.minVolumeRatio, 3)) {
      signalScore += 25;
      reasons.push(`Volume reached ${volumeRatio20d.toFixed(1)}x the 20-day average.`);
    } else if (volumeRatio20d != null && volumeRatio20d >= filters.minVolumeRatio) {
      signalScore += 15;
      reasons.push(`Volume reached ${volumeRatio20d.toFixed(1)}x the 20-day average.`);
    }

    if (breakout20d) {
      signalScore += 20;
      reasons.push("Closed at a 20-day closing-price breakout.");
    } else if (breakout10d) {
      signalScore += 12;
      reasons.push("Closed at a 10-day closing-price breakout.");
    }

    if (closedNearHigh) {
      signalScore += 10;
      reasons.push("Finished near the session high.");
    }

    signalScore = clamp(signalScore, 0, 100);

    let signal: RecommendationPatternMatch["signal"] = "watch";
    if (signalScore >= 80) {
      signal = "explosive";
    } else if (signalScore >= 55) {
      signal = "strong";
    }

    const matched =
      signalScore >= filters.minSignalScore &&
      (priceChangePercent ?? -Infinity) >= filters.minPriceChangePercent &&
      (volumeRatio20d ?? -Infinity) >= filters.minVolumeRatio &&
      (!filters.requireBreakout || breakout10d || breakout20d);

    const candidate: RecommendationPatternMatch = {
      matched,
      windowStartDate: windowPoints[0]?.date,
      windowEndDate: windowPoints.at(-1)?.date,
      signalDate: point.date,
      signalScore,
      signal,
      sessionsBeforeAnchor: anchorIndex - index,
      close: point.close,
      previousClose: previousPoint.close,
      priceChangePercent,
      volume: point.volume,
      avgVolume20,
      volumeRatio20d,
      breakout10d,
      breakout20d,
      closedNearHigh,
      reasons,
      summary: reasons.length ? reasons.join(" ") : "Momentum expanded, but not enough to clear the configured thresholds."
    };

    if (candidate.signalScore > bestMatch.signalScore || (candidate.matched && !bestMatch.matched)) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function buildEmptySmartMoneyPattern(referenceDate: string, windowPoints: ChartPoint[]): SmartMoneyPatternMatch {
  return {
    matched: false,
    actionable: false,
    stage: "none",
    signal: "watch",
    patternScore: 0,
    referenceDate,
    windowStartDate: windowPoints[0]?.date,
    windowEndDate: windowPoints.at(-1)?.date,
    leadInDate: undefined,
    surgePeakDate: undefined,
    surgeContinuationSessions: undefined,
    sessionsSinceLeadIn: undefined,
    sessionsSincePeak: undefined,
    leadInPriceChangePercent: undefined,
    pullbackStartDate: undefined,
    pullbackEndDate: undefined,
    breakoutDate: undefined,
    sessionsSinceBreakout: undefined,
    leadInClose: undefined,
    leadInHigh: undefined,
    leadInVolume: undefined,
    leadInVolumeRatio20d: undefined,
    surgePeakClose: undefined,
    surgePeakHigh: undefined,
    pullbackVolumeRatioToLeadIn: undefined,
    pullbackRangePercent: undefined,
    breakoutClose: undefined,
    breakoutPriceChangePercent: undefined,
    breakoutVolume: undefined,
    breakoutVolumeRatio20d: undefined,
    breakoutCloseVsLeadInPercent: undefined,
    referenceClose: undefined,
    referenceCloseVsBasePercent: undefined,
    referenceCloseVsPeakPercent: undefined,
    referenceCloseVsLeadInPercent: undefined,
    referenceCloseVsLeadInHighPercent: undefined,
    pullbackSessions: 0,
    pullbackMaxDrawdownPercent: undefined,
    breakout20d: false,
    closedNearHigh: false,
    reasons: ["No smart-money entry pattern was found in the selected window."],
    summary: "No smart-money entry pattern was found in the selected window."
  };
}

function resolveReferenceIndex(points: ChartPoint[], referenceDate?: string): number {
  if (!points.length) {
    return -1;
  }

  if (!referenceDate) {
    return points.length - 1;
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= referenceDate) {
      return index;
    }
  }

  return -1;
}

function getSmartMoneyStageRank(stage: SmartMoneyPatternMatch["stage"]): number {
  if (stage === "breakout") {
    return 2;
  }
  if (stage === "setup") {
    return 1;
  }
  return 0;
}

function isBetterSmartMoneyCandidate(candidate: SmartMoneyPatternMatch, bestMatch: SmartMoneyPatternMatch): boolean {
  if (candidate.actionable !== bestMatch.actionable) {
    return candidate.actionable;
  }

  const candidateStageRank = getSmartMoneyStageRank(candidate.stage);
  const bestStageRank = getSmartMoneyStageRank(bestMatch.stage);
  if (candidateStageRank !== bestStageRank) {
    return candidateStageRank > bestStageRank;
  }

  if (candidate.patternScore !== bestMatch.patternScore) {
    return candidate.patternScore > bestMatch.patternScore;
  }

  if (candidate.breakoutDate && bestMatch.breakoutDate) {
    return candidate.breakoutDate > bestMatch.breakoutDate;
  }

  if (candidate.leadInDate && bestMatch.leadInDate) {
    return candidate.leadInDate > bestMatch.leadInDate;
  }

  return false;
}

function evaluateSmartMoneyPatternWindow(
  points: ChartPoint[],
  referenceIndex: number,
  filters: SmartMoneyPatternFilters
): SmartMoneyPatternMatch {
  const windowStartIndex = Math.max(1, referenceIndex - filters.lookbackTradingDays + 1);
  const windowPoints = points.slice(windowStartIndex, referenceIndex + 1);
  const referenceDate = points[referenceIndex]?.date ?? "";

  if (!windowPoints.length) {
    return buildEmptySmartMoneyPattern(referenceDate, windowPoints);
  }

  let bestMatch = buildEmptySmartMoneyPattern(referenceDate, windowPoints);
  const referencePoint = points[referenceIndex];

  for (let leadInIndex = windowStartIndex; leadInIndex <= referenceIndex - filters.minPullbackSessions; leadInIndex += 1) {
    const leadInPoint = points[leadInIndex];
    const leadInPrevious = points[leadInIndex - 1];
    if (!leadInPoint || !leadInPrevious || !referencePoint) {
      continue;
    }

    const leadInPriceChangePercent = percentChange(leadInPoint.close, leadInPrevious.close);
    const leadInAvgVolume20 = getAverageVolumeBefore(points, leadInIndex, 20);
    const leadInVolumeRatio20d = ratio(leadInPoint.volume, leadInAvgVolume20);

    if (
      leadInPriceChangePercent == null ||
      leadInPriceChangePercent < filters.minLeadInPriceChangePercent ||
      leadInVolumeRatio20d == null ||
      leadInVolumeRatio20d < filters.minLeadInVolumeRatio
    ) {
      continue;
    }

    const preLeadBaseClose = getHighestCloseBefore(points, leadInIndex, filters.breakoutLookbackDays) ?? leadInPrevious.close;
    const surgePeakUpperBound = Math.min(referenceIndex - filters.minPullbackSessions, leadInIndex + 5);

    for (
      let surgePeakIndex = leadInIndex + filters.minSetupContinuationSessions;
      surgePeakIndex <= surgePeakUpperBound;
      surgePeakIndex += 1
    ) {
      const surgePeakPoint = points[surgePeakIndex];
      if (!surgePeakPoint) {
        continue;
      }

      const surgeAdvancePercent = percentChange(surgePeakPoint.close, leadInPoint.close);
      if (
        surgeAdvancePercent == null ||
        surgeAdvancePercent < filters.minSetupSurgeAdvancePercent
      ) {
        continue;
      }

      const pullbackPoints = points.slice(surgePeakIndex + 1, referenceIndex + 1);
      if (
        pullbackPoints.length < Math.max(filters.minPullbackSessions, filters.minSetupPullbackSessions) ||
        pullbackPoints.length > filters.maxPullbackSessions
      ) {
        continue;
      }

      const pullbackAvgVolume = averageNumberSeries(pullbackPoints.map((point) => point.volume));
      const pullbackVolumeRatioToLeadIn = ratio(pullbackAvgVolume, surgePeakPoint.volume ?? leadInPoint.volume);
      const pullbackLowestClose = Math.min(...pullbackPoints.map((point) => point.close));
      const pullbackHighestClose = Math.max(...pullbackPoints.map((point) => point.close));
      const pullbackMaxDrawdownPercent = Math.abs(percentChange(pullbackLowestClose, surgePeakPoint.close) ?? 0);
      const pullbackRangePercent = Math.abs(percentChange(pullbackHighestClose, pullbackLowestClose) ?? 0);
      const pullbackDownSessions = pullbackPoints.reduce((count, point, index) => {
        const comparisonPoint = index === 0 ? surgePeakPoint : pullbackPoints[index - 1];
        return count + (comparisonPoint && point.close < comparisonPoint.close ? 1 : 0);
      }, 0);

      if (
        pullbackVolumeRatioToLeadIn == null ||
        pullbackVolumeRatioToLeadIn > filters.maxPullbackAvgVolumeRatio ||
        pullbackMaxDrawdownPercent < filters.minPullbackDrawdownPercent ||
        pullbackDownSessions < filters.minSetupDownSessions ||
        pullbackRangePercent > filters.maxSetupPullbackRangePercent ||
        pullbackMaxDrawdownPercent > filters.maxSetupPullbackDrawdownPercent
      ) {
        continue;
      }

      const referenceCloseVsLeadInPercent = percentChange(referencePoint.close, leadInPoint.close);
      const referenceCloseVsLeadInHighPercent = percentChange(referencePoint.close, leadInPoint.high ?? leadInPoint.close);
      const referenceCloseVsBasePercent = percentChange(referencePoint.close, preLeadBaseClose);
      const referenceCloseVsPeakPercent = percentChange(referencePoint.close, surgePeakPoint.close);
      const surgeContinuationSessions = surgePeakIndex - leadInIndex;
      if (referenceCloseVsBasePercent == null || referenceCloseVsBasePercent < filters.minReferenceCloseVsBasePercent) {
        continue;
      }
      if (referenceCloseVsPeakPercent == null || referenceCloseVsPeakPercent > filters.maxSetupCloseVsPeakPercent) {
        continue;
      }

      let patternScore = 0;
      const reasons: string[] = [];

      if (leadInPriceChangePercent >= 12) {
        patternScore += 20;
      } else if (leadInPriceChangePercent >= 7) {
        patternScore += 16;
      } else {
        patternScore += 12;
      }

      if (surgeAdvancePercent >= 20) {
        patternScore += 22;
      } else if (surgeAdvancePercent >= 12) {
        patternScore += 18;
      } else {
        patternScore += 14;
      }
      reasons.push(
        `Lead-in started on ${leadInPoint.date} and the surge extended to ${surgePeakPoint.date} over ${surgeContinuationSessions + 1} sessions, advancing ${surgeAdvancePercent.toFixed(1)}% with volume still elevated.`
      );

      if (pullbackVolumeRatioToLeadIn <= 0.2) {
        patternScore += 24;
      } else if (pullbackVolumeRatioToLeadIn <= 0.35) {
        patternScore += 20;
      } else {
        patternScore += 14;
      }

      if (pullbackMaxDrawdownPercent <= 12) {
        patternScore += 16;
      } else if (pullbackMaxDrawdownPercent <= 22) {
        patternScore += 12;
      } else {
        patternScore += 8;
      }

      if (pullbackRangePercent <= 15) {
        patternScore += 14;
      } else if (pullbackRangePercent <= 25) {
        patternScore += 10;
      } else {
        patternScore += 6;
      }
      reasons.push(
        `After the surge peak, volume cooled to ${(pullbackVolumeRatioToLeadIn * 100).toFixed(0)}% while the digestion ranged ${pullbackRangePercent.toFixed(1)}% with ${pullbackDownSessions} down closes and a max close drawdown of ${pullbackMaxDrawdownPercent.toFixed(1)}%.`
      );

      if (referenceCloseVsBasePercent >= 10) {
        patternScore += 18;
      } else if (referenceCloseVsBasePercent >= 3) {
        patternScore += 14;
      } else {
        patternScore += 10;
      }

      if (referenceCloseVsPeakPercent != null) {
        if (referenceCloseVsPeakPercent >= -12) {
          patternScore += 12;
        } else if (referenceCloseVsPeakPercent >= -22) {
          patternScore += 8;
        } else {
          patternScore += 4;
        }
      }

      const sessionsSinceLeadIn = referenceIndex - leadInIndex;
      const sessionsSincePeak = referenceIndex - surgePeakIndex;
      if (sessionsSincePeak <= 5) {
        patternScore += 10;
      } else if (sessionsSincePeak <= 10) {
        patternScore += 8;
      } else {
        patternScore += 5;
      }
      reasons.push(
        `The current close is ${referenceCloseVsBasePercent.toFixed(1)}% above the pre-surge base and ${referenceCloseVsPeakPercent.toFixed(1)}% versus the surge peak close, so the move still looks like a live digestion pattern.`
      );

      patternScore = clamp(Math.round(patternScore * 0.68), 0, 100);
      const matched = patternScore >= filters.minSetupPatternScore;

      const candidate: SmartMoneyPatternMatch = {
        matched,
        actionable: matched,
        stage: "setup",
        signal: toSignal(patternScore),
        patternScore,
        referenceDate,
        windowStartDate: windowPoints[0]?.date,
        windowEndDate: windowPoints.at(-1)?.date,
        leadInDate: leadInPoint.date,
        surgePeakDate: surgePeakPoint.date,
        surgeContinuationSessions,
        sessionsSinceLeadIn,
        sessionsSincePeak,
        leadInPriceChangePercent,
        pullbackStartDate: pullbackPoints[0]?.date,
        pullbackEndDate: pullbackPoints.at(-1)?.date,
        breakoutDate: undefined,
        sessionsSinceBreakout: undefined,
        leadInClose: leadInPoint.close,
        leadInHigh: leadInPoint.high,
        leadInVolume: leadInPoint.volume,
        leadInVolumeRatio20d,
        surgePeakClose: surgePeakPoint.close,
        surgePeakHigh: surgePeakPoint.high,
        pullbackVolumeRatioToLeadIn,
        pullbackRangePercent,
        breakoutClose: undefined,
        breakoutPriceChangePercent: undefined,
        breakoutVolume: undefined,
        breakoutVolumeRatio20d: undefined,
        breakoutCloseVsLeadInPercent: undefined,
        referenceClose: referencePoint.close,
        referenceCloseVsBasePercent,
        referenceCloseVsPeakPercent: referenceCloseVsPeakPercent,
        referenceCloseVsLeadInPercent,
        referenceCloseVsLeadInHighPercent,
        pullbackSessions: pullbackPoints.length,
        pullbackMaxDrawdownPercent,
        breakout20d: false,
        closedNearHigh: false,
        reasons,
        summary: reasons.join(" ")
      };

      if (isBetterSmartMoneyCandidate(candidate, bestMatch)) {
        bestMatch = candidate;
      }
    }
  }

  for (let breakoutIndex = windowStartIndex + filters.minPullbackSessions + 1; breakoutIndex <= referenceIndex; breakoutIndex += 1) {
    const breakoutPoint = points[breakoutIndex];
    const breakoutPrevious = points[breakoutIndex - 1];
    if (!breakoutPoint || !breakoutPrevious) {
      continue;
    }

    const breakoutPriceChangePercent = percentChange(breakoutPoint.close, breakoutPrevious.close);
    const breakoutAvgVolume20 = getAverageVolumeBefore(points, breakoutIndex, 20);
    const breakoutVolumeRatio20d = ratio(breakoutPoint.volume, breakoutAvgVolume20);
    const highestClose20 = getHighestCloseBefore(points, breakoutIndex, filters.breakoutLookbackDays);
    const breakout20d = highestClose20 != null ? breakoutPoint.close >= highestClose20 : false;
    const closedNearHigh = breakoutPoint.high != null ? breakoutPoint.close >= breakoutPoint.high * filters.closeNearHighRatio : false;

    if (
      breakoutPriceChangePercent == null ||
      breakoutPriceChangePercent < filters.minBreakoutPriceChangePercent ||
      breakoutVolumeRatio20d == null ||
      breakoutVolumeRatio20d < filters.minBreakoutVolumeRatio ||
      !breakout20d ||
      !closedNearHigh
    ) {
      continue;
    }

    const leadInStartIndex = Math.max(windowStartIndex, breakoutIndex - (filters.maxPullbackSessions + 3));
    for (let leadInIndex = leadInStartIndex; leadInIndex <= breakoutIndex - filters.minPullbackSessions - 1; leadInIndex += 1) {
      const leadInPoint = points[leadInIndex];
      const leadInPrevious = points[leadInIndex - 1];
      if (!leadInPoint || !leadInPrevious) {
        continue;
      }

      const leadInPriceChangePercent = percentChange(leadInPoint.close, leadInPrevious.close);
      const leadInAvgVolume20 = getAverageVolumeBefore(points, leadInIndex, 20);
      const leadInVolumeRatio20d = ratio(leadInPoint.volume, leadInAvgVolume20);

      if (
        leadInPriceChangePercent == null ||
        leadInPriceChangePercent < filters.minLeadInPriceChangePercent ||
        leadInVolumeRatio20d == null ||
        leadInVolumeRatio20d < filters.minLeadInVolumeRatio
      ) {
        continue;
      }

      const pullbackPoints = points.slice(leadInIndex + 1, breakoutIndex);
      if (
        pullbackPoints.length < filters.minPullbackSessions ||
        pullbackPoints.length > filters.maxPullbackSessions
      ) {
        continue;
      }

      const pullbackAvgVolume = averageNumberSeries(pullbackPoints.map((point) => point.volume));
      const pullbackVolumeRatioToLeadIn = ratio(pullbackAvgVolume, leadInPoint.volume);
      const pullbackLowestClose = Math.min(...pullbackPoints.map((point) => point.close));
      const pullbackHighestHigh = Math.max(...pullbackPoints.map((point) => point.high ?? point.close));
      const pullbackLowestLow = Math.min(...pullbackPoints.map((point) => point.low ?? point.close));
      const pullbackMaxDrawdownPercent = Math.abs(percentChange(pullbackLowestClose, leadInPoint.close) ?? 0);
      const pullbackRangePercent = Math.abs(percentChange(pullbackHighestHigh, pullbackLowestLow) ?? 0);
      const pullbackDownSessions = pullbackPoints.reduce((count, point, index) => {
        const comparisonPoint = index === 0 ? leadInPoint : pullbackPoints[index - 1];
        return count + (comparisonPoint && point.close < comparisonPoint.close ? 1 : 0);
      }, 0);

      if (
        pullbackVolumeRatioToLeadIn == null ||
        pullbackVolumeRatioToLeadIn > filters.maxPullbackAvgVolumeRatio ||
        pullbackMaxDrawdownPercent < filters.minPullbackDrawdownPercent ||
        pullbackDownSessions < 1 ||
        pullbackRangePercent > filters.maxPullbackRangePercent ||
        pullbackMaxDrawdownPercent > filters.maxPullbackDrawdownPercent
      ) {
        continue;
      }

      const breakoutCloseVsLeadInPercent = percentChange(breakoutPoint.close, leadInPoint.close);
      const referenceCloseVsLeadInPercent = referencePoint ? percentChange(referencePoint.close, leadInPoint.close) : undefined;
      const referenceCloseVsLeadInHighPercent = referencePoint
        ? percentChange(referencePoint.close, leadInPoint.high ?? leadInPoint.close)
        : undefined;
      if (
        referenceCloseVsLeadInPercent != null &&
        referenceCloseVsLeadInPercent < filters.minReferenceCloseVsLeadInPercent
      ) {
        continue;
      }
      let patternScore = 0;
      const reasons: string[] = [];

      if (leadInPriceChangePercent >= 10) {
        patternScore += 20;
      } else {
        patternScore += 14;
      }
      reasons.push(`Lead-in day on ${leadInPoint.date} rose ${leadInPriceChangePercent.toFixed(1)}% with volume ${leadInVolumeRatio20d.toFixed(1)}x.`);

      if (pullbackVolumeRatioToLeadIn <= 0.45) {
        patternScore += 22;
      } else {
        patternScore += 16;
      }
      reasons.push(
        `Pullback held for ${pullbackPoints.length} sessions with max drawdown ${pullbackMaxDrawdownPercent.toFixed(1)}%, ${pullbackDownSessions} down closes, a ${pullbackRangePercent.toFixed(1)}% range, and volume contraction to ${(pullbackVolumeRatioToLeadIn * 100).toFixed(0)}% of the lead-in day.`
      );

      if (pullbackRangePercent <= 4) {
        patternScore += 12;
      } else if (pullbackRangePercent <= 7) {
        patternScore += 8;
      } else {
        patternScore += 4;
      }

      if (breakoutPriceChangePercent >= 20) {
        patternScore += 34;
      } else if (breakoutPriceChangePercent >= 12) {
        patternScore += 28;
      } else {
        patternScore += 22;
      }
      reasons.push(
        `Breakout day on ${breakoutPoint.date} rose ${breakoutPriceChangePercent.toFixed(1)}% with volume ${breakoutVolumeRatio20d.toFixed(1)}x, cleared the ${filters.breakoutLookbackDays}-day close breakout, and finished near the high.`
      );

      patternScore = clamp(patternScore, 0, 100);
      const sessionsSinceBreakout = referenceIndex - breakoutIndex;
      const actionable = sessionsSinceBreakout <= filters.recentSignalSessions;
      const matched = patternScore >= filters.minBreakoutPatternScore;

      const candidate: SmartMoneyPatternMatch = {
        matched,
        actionable: matched && actionable,
        stage: "breakout",
        signal: toSignal(patternScore),
        patternScore,
        referenceDate,
        windowStartDate: windowPoints[0]?.date,
        windowEndDate: windowPoints.at(-1)?.date,
        leadInDate: leadInPoint.date,
        sessionsSinceLeadIn: referenceIndex - leadInIndex,
        leadInPriceChangePercent,
        pullbackStartDate: pullbackPoints[0]?.date,
        pullbackEndDate: pullbackPoints.at(-1)?.date,
        breakoutDate: breakoutPoint.date,
        sessionsSinceBreakout,
        leadInClose: leadInPoint.close,
        leadInHigh: leadInPoint.high,
        leadInVolume: leadInPoint.volume,
        leadInVolumeRatio20d,
        pullbackVolumeRatioToLeadIn,
        pullbackRangePercent,
        breakoutClose: breakoutPoint.close,
        breakoutPriceChangePercent,
        breakoutVolume: breakoutPoint.volume,
        breakoutVolumeRatio20d,
        breakoutCloseVsLeadInPercent,
        referenceClose: referencePoint?.close,
        referenceCloseVsPeakPercent: referencePoint && breakoutPoint ? percentChange(referencePoint.close, breakoutPoint.close) : undefined,
        referenceCloseVsLeadInPercent,
        referenceCloseVsLeadInHighPercent,
        pullbackSessions: pullbackPoints.length,
        pullbackMaxDrawdownPercent,
        breakout20d,
        closedNearHigh,
        reasons,
        summary: reasons.join(" ")
      };

      if (isBetterSmartMoneyCandidate(candidate, bestMatch)) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
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

export async function analyzeRecommendationPattern(
  input: RecommendationRequest,
  overrides?: Partial<RecommendationPatternFilters>
): Promise<RecommendationPatternAnalysis> {
  const filters: RecommendationPatternFilters = {
    ...defaultRecommendationPatternFilters,
    ...overrides
  };
  const symbol = resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix);
  const historyLookback = Math.max(90, filters.breakoutWindowDays + filters.lookbackTradingDays + 25);
  const period1 = addDays(input.anchorDate, -historyLookback);
  const { points } = await fetchQuoteAndChart(symbol, { period1 });

  if (!points.length) {
    throw new Error(`No chart data available for ${symbol}`);
  }

  const anchorIndex = points.findIndex((point) => point.date >= input.anchorDate);
  if (anchorIndex === -1) {
    throw new Error(`No trading session found on or after ${input.anchorDate} for ${symbol}`);
  }

  const anchorPoint = points[anchorIndex];
  const pattern = evaluatePreAnchorMomentumWindow(points, anchorIndex, filters);

  return {
    name: input.name,
    symbol: input.symbol,
    resolvedSymbol: symbol,
    anchorDate: input.anchorDate,
    tradingAnchorDate: anchorPoint.date,
    latestMentionDate: input.latestMentionDate,
    note: input.note,
    pattern
  };
}

export async function analyzeRecommendationPatterns(
  inputs: RecommendationRequest[],
  overrides?: Partial<RecommendationPatternFilters>
) {
  return Promise.all(inputs.map((input) => analyzeRecommendationPattern(input, overrides)));
}

export async function analyzeSmartMoneyPattern(
  input: SmartMoneyPatternRequest,
  overrides?: Partial<SmartMoneyPatternFilters>
): Promise<SmartMoneyPatternAnalysis> {
  const filters = resolveSmartMoneyPatternFilters({
    ...defaultSmartMoneyPatternFilters,
    ...overrides
  });
  const symbol = resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix);
  const referenceDate = input.referenceDate ?? toIsoDate(new Date());
  const maxLookbackWindow = Math.max(...filters.lookbackWindows);
  const historyLookback = Math.max(90, maxLookbackWindow + filters.breakoutLookbackDays + filters.maxPullbackSessions + 25);
  const period1 = addDays(referenceDate, -historyLookback);
  const { points } = await fetchQuoteAndChart(symbol, { period1 });

  if (!points.length) {
    throw new Error(`No chart data available for ${symbol}`);
  }

  const referenceIndex = resolveReferenceIndex(points, input.referenceDate);
  if (referenceIndex === -1) {
    throw new Error(`No trading session found on or before ${referenceDate} for ${symbol}`);
  }

  const referencePoint = points[referenceIndex];
  const pattern = evaluateSmartMoneyPattern(points, referenceIndex, filters, {
    marketContext: input.marketContext,
    debug: input.debug
  });

  return {
    name: input.name,
    symbol: input.symbol,
    resolvedSymbol: symbol,
    referenceDate: input.referenceDate,
    tradingReferenceDate: referencePoint.date,
    note: input.note,
    pattern
  };
}

export async function analyzeSmartMoneyPatterns(
  inputs: SmartMoneyPatternRequest[],
  overrides?: Partial<SmartMoneyPatternFilters>
) {
  return Promise.all(inputs.map((input) => analyzeSmartMoneyPattern(input, overrides)));
}
