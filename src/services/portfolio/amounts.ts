import type { PortfolioHolding } from "./types.js";

const MAX_REPORTED_INVESTED_AMOUNT_DEVIATION_RATE = 0.02;

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export type HoldingInvestedAmountResolution = {
  amount: number;
  avgBasedAmount: number;
  reportedAmount?: number;
  correctedReportedAmount: boolean;
};

export function resolveHoldingInvestedAmount(
  holding: Pick<PortfolioHolding, "avgPrice" | "quantity" | "investedAmount">
): HoldingInvestedAmountResolution {
  const avgBasedAmount =
    isFinitePositive(holding.avgPrice) && isFinitePositive(holding.quantity)
      ? holding.avgPrice * holding.quantity
      : 0;
  const reportedAmount = isFinitePositive(holding.investedAmount)
    ? holding.investedAmount
    : undefined;
  const reportedDeviationRate =
    reportedAmount && avgBasedAmount > 0
      ? Math.abs(reportedAmount - avgBasedAmount) / avgBasedAmount
      : 0;
  const correctedReportedAmount =
    Boolean(reportedAmount) &&
    avgBasedAmount > 0 &&
    reportedDeviationRate >= MAX_REPORTED_INVESTED_AMOUNT_DEVIATION_RATE;

  return {
    amount:
      reportedAmount && !correctedReportedAmount
        ? reportedAmount
        : avgBasedAmount || reportedAmount || 0,
    avgBasedAmount,
    reportedAmount,
    correctedReportedAmount
  };
}

export function calculateHoldingEvaluationAmount(
  holding: Pick<PortfolioHolding, "currentPrice" | "quantity">
) {
  return isFinitePositive(holding.currentPrice) && isFinitePositive(holding.quantity)
    ? holding.currentPrice * holding.quantity
    : 0;
}
