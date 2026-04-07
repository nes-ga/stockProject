import type { ChartPoint, SmartMoneyBacktestResult, SmartMoneyPatternMatch } from "../types.js";

type SmartMoneyBacktestOptions = {
  evaluationWindows?: number[];
  primaryWindowDays?: number;
  breakoutBufferPercent?: number;
};

const DEFAULT_BACKTEST_OPTIONS: Required<SmartMoneyBacktestOptions> = {
  evaluationWindows: [5, 10, 20],
  primaryWindowDays: 20,
  breakoutBufferPercent: 0
};

function percentChange(current: number, previous?: number): number | undefined {
  if (!previous || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function getPointHigh(point: ChartPoint): number {
  return point.high ?? point.close;
}

function getPointLow(point: ChartPoint): number {
  return point.low ?? point.close;
}

export function calculateSmartMoneyBacktestResult(
  points: ChartPoint[],
  signalIndex: number,
  pattern: SmartMoneyPatternMatch,
  options?: SmartMoneyBacktestOptions
): SmartMoneyBacktestResult | undefined {
  if (signalIndex < 0 || signalIndex >= points.length || pattern.stage === "none") {
    return undefined;
  }

  const merged = {
    ...DEFAULT_BACKTEST_OPTIONS,
    ...options
  };
  const signalPoint = points[signalIndex];
  const maxWindow = Math.max(merged.primaryWindowDays, ...merged.evaluationWindows);
  const futurePoints = points.slice(signalIndex + 1, signalIndex + 1 + maxWindow);
  const analysisWindow = futurePoints.slice(0, merged.primaryWindowDays);
  const breakoutReferencePrice = pattern.tradePlan?.breakoutPrice ?? pattern.breakoutLevel ?? pattern.surgePeakHigh;
  const stopLossReferencePrice = pattern.tradePlan?.stopLoss ?? pattern.invalidationPrice;

  const forwardReturnByWindow = new Map<number, number | undefined>();
  for (const window of merged.evaluationWindows) {
    const point = futurePoints[window - 1];
    forwardReturnByWindow.set(window, point ? percentChange(point.close, signalPoint.close) : undefined);
  }

  const highestHigh = analysisWindow.length ? Math.max(...analysisWindow.map((point) => getPointHigh(point))) : undefined;
  const lowestLow = analysisWindow.length ? Math.min(...analysisWindow.map((point) => getPointLow(point))) : undefined;

  return {
    signalDate: signalPoint.date,
    signalClose: signalPoint.close,
    availableSessions: futurePoints.length,
    evaluationWindows: merged.evaluationWindows,
    forwardReturn5: forwardReturnByWindow.get(5),
    forwardReturn10: forwardReturnByWindow.get(10),
    forwardReturn20: forwardReturnByWindow.get(20),
    maxRunupPct: highestHigh != null ? percentChange(highestHigh, signalPoint.close) : undefined,
    maxDrawdownPct: lowestLow != null ? percentChange(lowestLow, signalPoint.close) : undefined,
    breakoutSuccess:
      breakoutReferencePrice != null
        ? signalPoint.close >= breakoutReferencePrice ||
          analysisWindow.some((point) => getPointHigh(point) >= breakoutReferencePrice * (1 + merged.breakoutBufferPercent / 100))
        : undefined,
    stopLossHit:
      stopLossReferencePrice != null
        ? signalPoint.close <= stopLossReferencePrice || analysisWindow.some((point) => getPointLow(point) <= stopLossReferencePrice)
        : undefined,
    breakoutReferencePrice,
    stopLossReferencePrice
  };
}
