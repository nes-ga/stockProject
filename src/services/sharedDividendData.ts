import type { ChartPoint, FundamentalsSummary } from "../types.js";

export function parseAnnualPeriodLabel(label: string | undefined): { year: number; month: number } | undefined {
  if (!label) {
    return undefined;
  }

  const match = label.match(/(\d{4})\.(\d{2})/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return undefined;
  }

  return { year, month };
}

export function findPeriodReferenceClose(points: ChartPoint[], label: string | undefined): number | undefined {
  const period = parseAnnualPeriodLabel(label);
  if (!period) {
    return undefined;
  }

  const monthPrefix = `${period.year}-${String(period.month).padStart(2, "0")}`;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point?.date?.startsWith(monthPrefix)) {
      return point.close;
    }
  }

  const monthEnd = `${monthPrefix}-31`;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point?.date && point.date <= monthEnd) {
      return point.close;
    }
  }

  return undefined;
}

export function calculateDividendYieldPercent(dividendAmount?: number, referenceClose?: number): number | undefined {
  if (
    dividendAmount == null ||
    !Number.isFinite(dividendAmount) ||
    referenceClose == null ||
    !Number.isFinite(referenceClose) ||
    referenceClose <= 0
  ) {
    return undefined;
  }

  return (dividendAmount / referenceClose) * 100;
}

export function enrichFundamentalsWithDividendYields(fundamentals: FundamentalsSummary | undefined, points: ChartPoint[]) {
  if (!fundamentals) {
    return fundamentals;
  }

  const annual = fundamentals.annual
    ? {
        ...fundamentals.annual,
        dividendYield:
          fundamentals.annual.dividendYield ??
          calculateDividendYieldPercent(
            fundamentals.annual.dividendPerShare,
            findPeriodReferenceClose(points, fundamentals.annual.label)
          )
      }
    : fundamentals.annual;

  const annualHistory = Array.isArray(fundamentals.annualHistory)
    ? fundamentals.annualHistory.map((period) => ({
        ...period,
        dividendYield:
          period.dividendYield ?? calculateDividendYieldPercent(period.dividendPerShare, findPeriodReferenceClose(points, period.label))
      }))
    : fundamentals.annualHistory;

  const dividendHistory = Array.isArray(fundamentals.dividendHistory)
    ? fundamentals.dividendHistory.map((entry) => ({
        ...entry,
        dividendYield:
          entry.dividendYield ?? calculateDividendYieldPercent(entry.dividendAmount, findPeriodReferenceClose(points, entry.label))
      }))
    : fundamentals.dividendHistory;

  return {
    ...fundamentals,
    annual,
    annualHistory,
    dividendHistory
  } satisfies FundamentalsSummary;
}
