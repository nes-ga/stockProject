import type { ChartPoint, PostSurgePullbackAnalysis } from "../types.js";

// 2026-08-26: 이 설정 블록만 제거하면 급등 후 눌림형 임시 후보를 원복할 수 있다.
export const POST_SURGE_PULLBACK_MIN_SURGE_CHANGE_PERCENT = 12;
export const POST_SURGE_PULLBACK_MIN_SURGE_VOLUME_RATIO = 4;
export const POST_SURGE_PULLBACK_MIN_SURGE_VOLUME_SHARES = 2_000_000;
export const POST_SURGE_PULLBACK_MIN_SURGE_TURNOVER_KRW = 1_500_000_000;
export const POST_SURGE_PULLBACK_MIN_SESSIONS = 3;
export const POST_SURGE_PULLBACK_MAX_SESSIONS = 15;
export const POST_SURGE_PULLBACK_MAX_VOLUME_RATIO = 0.35;
export const POST_SURGE_PULLBACK_MAX_LATEST_VOLUME_RATIO = 0.5;
export const POST_SURGE_PULLBACK_MIN_DRAWDOWN_PERCENT = 5;
export const POST_SURGE_PULLBACK_MAX_DRAWDOWN_PERCENT = 28;
export const POST_SURGE_PULLBACK_MAX_RANGE_PERCENT = 35;
export const POST_SURGE_PULLBACK_MIN_SUPPORT_RECOVERY_PERCENT = 3;
export const POST_SURGE_PULLBACK_MIN_PRICE_KRW = 5_000;
export const POST_SURGE_PULLBACK_MIN_TURNOVER_KRW = 1_000_000_000;
export const POST_SURGE_PULLBACK_MAX_ATR_PERCENT = 12;
export const POST_SURGE_PULLBACK_MIN_CLOSE_TO_SURGE_HIGH_RATIO = 0.9;

function percentChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);
  return validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : 0;
}

function getHigh(point: ChartPoint) {
  return point.high ?? point.close;
}

function getLow(point: ChartPoint) {
  return point.low ?? point.close;
}

function getSma(points: ChartPoint[]) {
  return average(points.map((point) => point.close));
}

function getAtrPercent(points: ChartPoint[]) {
  const trueRanges = points.slice(1).map((point, index) => {
    const previousClose = points[index].close;
    return Math.max(getHigh(point) - getLow(point), Math.abs(getHigh(point) - previousClose), Math.abs(getLow(point) - previousClose));
  });
  const atr = average(trueRanges);
  const latestClose = points.at(-1)?.close ?? 0;
  return latestClose > 0 ? (atr / latestClose) * 100 : 100;
}

function buildRejectedAnalysis(
  referencePoint: ChartPoint,
  reasons: string[]
): PostSurgePullbackAnalysis {
  return {
    matched: false,
    executionEligible: false,
    surgeDate: referencePoint.date,
    pullbackStartDate: referencePoint.date,
    pullbackEndDate: referencePoint.date,
    surgeClose: referencePoint.close,
    referenceClose: referencePoint.close,
    pullbackLow: referencePoint.close,
    pullbackHigh: referencePoint.close,
    surgeChangePercent: 0,
    surgeVolumeRatio: 0,
    pullbackSessions: 0,
    pullbackDrawdownPercent: 0,
    pullbackRangePercent: 0,
    pullbackVolumeRatio: 1,
    latestVolumeRatio: 1,
    downSessions: 0,
    supportRecoveryPercent: 0,
    sma20: referencePoint.close,
    sma20SlopePercent: 0,
    closeVsSma20Percent: 0,
    atrPercent: 100,
    turnoverKrw: 0,
    score: 0,
    rejectionReasons: reasons
  };
}

export function evaluatePostSurgePullback(
  points: ChartPoint[],
  referenceIndex = points.length - 1
): PostSurgePullbackAnalysis {
  const referencePoint = points[referenceIndex];
  if (!referencePoint || referenceIndex < 25) {
    return buildRejectedAnalysis(referencePoint ?? points[0] ?? { date: "", close: 0 }, ["post_surge_insufficient_history"]);
  }

  const searchStart = Math.max(21, referenceIndex - 15);
  let best: PostSurgePullbackAnalysis | undefined;

  for (let surgeIndex = searchStart; surgeIndex <= referenceIndex - POST_SURGE_PULLBACK_MIN_SESSIONS; surgeIndex += 1) {
    const surge = points[surgeIndex];
    const previous = points.slice(surgeIndex - 20, surgeIndex);
    const pullback = points.slice(surgeIndex + 1, referenceIndex + 1);
    if (pullback.length < POST_SURGE_PULLBACK_MIN_SESSIONS || pullback.length > POST_SURGE_PULLBACK_MAX_SESSIONS) {
      continue;
    }

    const averageVolume = average(previous.map((point) => point.volume ?? 0));
    const surgeVolume = surge.volume ?? 0;
    const surgeClose = surge.close;
    const surgeHigh = getHigh(surge);
    const surgeChangePercent = percentChange(surgeClose, points[surgeIndex - 1]?.close ?? 0);
    const surgeVolumeRatio = averageVolume > 0 ? surgeVolume / averageVolume : 0;
    const surgeTurnoverKrw = surgeClose * surgeVolume;
    const surgeCloseToHighRatio = surgeHigh > 0 ? surgeClose / surgeHigh : 0;

    if (
      surgeClose < POST_SURGE_PULLBACK_MIN_PRICE_KRW ||
      surgeChangePercent < POST_SURGE_PULLBACK_MIN_SURGE_CHANGE_PERCENT ||
      surgeVolumeRatio < POST_SURGE_PULLBACK_MIN_SURGE_VOLUME_RATIO ||
      surgeVolume < POST_SURGE_PULLBACK_MIN_SURGE_VOLUME_SHARES ||
      surgeTurnoverKrw < POST_SURGE_PULLBACK_MIN_SURGE_TURNOVER_KRW ||
      surgeCloseToHighRatio < POST_SURGE_PULLBACK_MIN_CLOSE_TO_SURGE_HIGH_RATIO ||
      surgeClose <= (surge.open ?? points[surgeIndex - 1]?.close ?? surgeClose)
    ) {
      continue;
    }

    const pullbackVolumes = pullback.map((point) => point.volume ?? 0);
    const pullbackAverageVolume = average(pullbackVolumes);
    const pullbackVolumeRatio = surgeVolume > 0 ? pullbackAverageVolume / surgeVolume : 1;
    const latestVolumeRatio = surgeVolume > 0 ? (referencePoint.volume ?? 0) / surgeVolume : 1;
    const pullbackLow = Math.min(...pullback.map(getLow));
    const pullbackHigh = Math.max(...pullback.map(getHigh));
    const pullbackLowestClose = Math.min(...pullback.map((point) => point.close));
    const pullbackDrawdownPercent = Math.abs(percentChange(pullbackLowestClose, surgeClose));
    const pullbackRangePercent = Math.abs(percentChange(pullbackLow, surgeHigh));
    const supportRecoveryPercent = percentChange(referencePoint.close, pullbackLow);
    const downSessions = pullback.reduce(
      (count, point, index) => count + (point.close < (index === 0 ? surgeClose : pullback[index - 1].close) ? 1 : 0),
      0
    );
    const newHighAfterSurge = pullbackHigh > surgeHigh * 1.01;

    if (
      pullbackVolumeRatio > POST_SURGE_PULLBACK_MAX_VOLUME_RATIO ||
      latestVolumeRatio > POST_SURGE_PULLBACK_MAX_LATEST_VOLUME_RATIO ||
      pullbackDrawdownPercent < POST_SURGE_PULLBACK_MIN_DRAWDOWN_PERCENT ||
      pullbackDrawdownPercent > POST_SURGE_PULLBACK_MAX_DRAWDOWN_PERCENT ||
      pullbackRangePercent > POST_SURGE_PULLBACK_MAX_RANGE_PERCENT ||
      downSessions < 2 ||
      newHighAfterSurge ||
      supportRecoveryPercent < 1
    ) {
      continue;
    }

    const recentPoints = points.slice(Math.max(0, referenceIndex - 19), referenceIndex + 1);
    const sma20 = getSma(recentPoints);
    const priorSma20 = getSma(points.slice(Math.max(0, referenceIndex - 24), Math.max(0, referenceIndex - 4)));
    const sma20SlopePercent = percentChange(sma20, priorSma20);
    const closeVsSma20Percent = percentChange(referencePoint.close, sma20);
    const atrPercent = getAtrPercent(points.slice(Math.max(0, referenceIndex - 14), referenceIndex + 1));
    const turnoverKrw = referencePoint.close * (referencePoint.volume ?? 0);
    const rejectionReasons: string[] = [];

    if (referencePoint.close < POST_SURGE_PULLBACK_MIN_PRICE_KRW) {
      rejectionReasons.push("post_surge_price_floor_failed");
    }
    if (turnoverKrw < POST_SURGE_PULLBACK_MIN_TURNOVER_KRW) {
      rejectionReasons.push("post_surge_turnover_floor_failed");
    }
    if (referencePoint.close <= sma20) {
      rejectionReasons.push("post_surge_close_below_sma20");
    }
    if (sma20SlopePercent <= 0) {
      rejectionReasons.push("post_surge_sma20_slope_not_positive");
    }
    if (supportRecoveryPercent < POST_SURGE_PULLBACK_MIN_SUPPORT_RECOVERY_PERCENT) {
      rejectionReasons.push("post_surge_support_recovery_insufficient");
    }
    if (atrPercent > POST_SURGE_PULLBACK_MAX_ATR_PERCENT) {
      rejectionReasons.push("post_surge_volatility_too_high");
    }

    const score = Math.round(
      Math.min(25, surgeChangePercent * 1.5) +
      Math.min(20, surgeVolumeRatio * 2.5) +
      Math.min(20, pullback.length * 2) +
      Math.min(20, Math.max(0, 20 - pullbackDrawdownPercent / 2)) +
      Math.min(15, Math.max(0, (POST_SURGE_PULLBACK_MAX_VOLUME_RATIO - pullbackVolumeRatio) * 35))
    );
    const candidate: PostSurgePullbackAnalysis = {
      matched: true,
      executionEligible: rejectionReasons.length === 0,
      surgeDate: surge.date,
      pullbackStartDate: pullback[0].date,
      pullbackEndDate: pullback.at(-1)?.date ?? referencePoint.date,
      surgeClose,
      referenceClose: referencePoint.close,
      pullbackLow,
      pullbackHigh,
      surgeChangePercent,
      surgeVolumeRatio,
      pullbackSessions: pullback.length,
      pullbackDrawdownPercent,
      pullbackRangePercent,
      pullbackVolumeRatio,
      latestVolumeRatio,
      downSessions,
      supportRecoveryPercent,
      sma20,
      sma20SlopePercent,
      closeVsSma20Percent,
      atrPercent,
      turnoverKrw,
      score,
      rejectionReasons
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best ?? buildRejectedAnalysis(referencePoint, ["post_surge_pullback_not_found"]);
}
