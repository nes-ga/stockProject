import type { ChartPoint } from "../../types.js";

export type PortfolioTechnicalSetup = {
  status: "READY" | "FORMING" | "WAIT" | "UNAVAILABLE";
  latestDate?: string;
  currentPrice?: number;
  sma20?: number;
  sma20Slope5dPercent?: number;
  distanceFromSma20Percent?: number;
  boxRange20dPercent?: number;
  recentLow?: number;
  priorLow?: number;
  invalidPrice?: number;
  checks: {
    sma20FlatOrRising: boolean;
    nearSma20: boolean;
    boxFormed: boolean;
    lowHolding: boolean;
  };
  summary: string;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function round(value: number | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildPortfolioTechnicalSetup(points: ChartPoint[]): PortfolioTechnicalSetup {
  const valid = points.filter((point) => Number.isFinite(point.close) && point.close > 0);
  const emptyChecks = { sma20FlatOrRising: false, nearSma20: false, boxFormed: false, lowHolding: false };
  if (valid.length < 40) {
    return { status: "UNAVAILABLE", checks: emptyChecks, summary: "일봉 40거래일이 부족해 20일선 박스권을 판독하지 못했습니다." };
  }
  const latest = valid.at(-1)!;
  const closes = valid.map((point) => point.close);
  const sma20 = average(closes.slice(-20))!;
  const priorSma20 = average(closes.slice(-25, -5))!;
  const recent20 = valid.slice(-20);
  const recent10 = valid.slice(-10);
  const prior10 = valid.slice(-20, -10);
  const high20 = Math.max(...recent20.map((point) => point.high ?? point.close));
  const low20 = Math.min(...recent20.map((point) => point.low ?? point.close));
  const recentLow = Math.min(...recent10.map((point) => point.low ?? point.close));
  const priorLow = Math.min(...prior10.map((point) => point.low ?? point.close));
  const sma20Slope5dPercent = ((sma20 - priorSma20) / priorSma20) * 100;
  const distanceFromSma20Percent = ((latest.close - sma20) / sma20) * 100;
  const boxRange20dPercent = ((high20 - low20) / sma20) * 100;
  const checks = {
    sma20FlatOrRising: sma20Slope5dPercent >= -0.5,
    nearSma20: Math.abs(distanceFromSma20Percent) <= 5,
    boxFormed: boxRange20dPercent <= 12,
    lowHolding: recentLow >= priorLow * 0.98
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const status = passed === 4 ? "READY" : passed >= 2 ? "FORMING" : "WAIT";
  return {
    status,
    latestDate: latest.date,
    currentPrice: latest.close,
    sma20: round(sma20, 0),
    sma20Slope5dPercent: round(sma20Slope5dPercent),
    distanceFromSma20Percent: round(distanceFromSma20Percent),
    boxRange20dPercent: round(boxRange20dPercent),
    recentLow: round(recentLow, 0),
    priorLow: round(priorLow, 0),
    invalidPrice: round(low20 * 0.98, 0),
    checks,
    summary: status === "READY"
      ? "저점 방어와 20일선 박스권이 함께 확인됐습니다."
      : status === "FORMING"
        ? "저점 또는 20일선 박스권이 형성 중이라 추가 확인이 필요합니다."
        : "20일선 박스권과 저점 방어 조건이 아직 부족합니다."
  };
}
