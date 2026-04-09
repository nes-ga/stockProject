import type { LongTermMetricSnapshot } from "./metrics.js";
import type { LongTermScanFilters } from "../../types.js";
import { clamp } from "./utils.js";

function scoreTurnover(value: number | undefined, threshold: number, maxScore: number): number {
  if (value == null || value <= 0) {
    return 0;
  }

  if (value >= threshold * 4) {
    return maxScore;
  }
  if (value >= threshold * 2) {
    return Math.round(maxScore * 0.82);
  }
  if (value >= threshold) {
    return Math.round(maxScore * 0.62);
  }
  if (value >= threshold * 0.7) {
    return Math.round(maxScore * 0.35);
  }
  return Math.round(maxScore * 0.1);
}

export function calculateLiquidityScore(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): number {
  const turnover20Score = scoreTurnover(metrics.liquidity.avgTurnover20, filters.minimumTradableTurnover20, 45);
  const turnover60Score = scoreTurnover(metrics.liquidity.avgTurnover60, filters.minimumTradableTurnover60, 30);
  const consistencyScore = Math.round(((metrics.liquidity.volumeConsistency ?? 0) / 100) * 25);

  return clamp(turnover20Score + turnover60Score + consistencyScore, 0, 100);
}
