import type { ChartPoint, SmartMoneyPatternMatch } from "../../types.js";

export function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

export function averageNumberSeries(values: Array<number | undefined>): number | undefined {
  return average(values.filter((value): value is number => typeof value === "number"));
}

export function ratio(value?: number, base?: number): number | undefined {
  if (value == null || base == null || base === 0) {
    return undefined;
  }

  return value / base;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function percentChange(current: number, previous?: number): number | undefined {
  if (!previous || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

export function getPointHigh(point: ChartPoint): number {
  return point.high ?? point.close;
}

export function getPointLow(point: ChartPoint): number {
  return point.low ?? point.close;
}

export function getTurnoverValue(point: ChartPoint): number | undefined {
  return point.volume != null ? point.close * point.volume : undefined;
}

export function getAverageVolumeBefore(points: ChartPoint[], index: number, period = 20): number | undefined {
  return averageNumberSeries(points.slice(Math.max(0, index - period), index).map((point) => point.volume));
}

export function getAverageCloseThrough(points: ChartPoint[], index: number, period = 20): number | undefined {
  if (index < 0) {
    return undefined;
  }

  return averageNumberSeries(points.slice(Math.max(0, index - period + 1), index + 1).map((point) => point.close));
}

export function getHighestCloseBefore(points: ChartPoint[], index: number, period: number): number | undefined {
  const closes = points.slice(Math.max(0, index - period), index).map((point) => point.close);
  return closes.length ? Math.max(...closes) : undefined;
}

export function getStageRank(stage: SmartMoneyPatternMatch["stage"]): number {
  return stage === "breakout" ? 2 : stage === "setup" ? 1 : 0;
}

export function getWorkflowStatusRank(status: SmartMoneyPatternMatch["status"]): number {
  switch (status) {
    case "breakout_confirmed":
      return 8;
    case "buy_ready":
      return 7;
    case "breakout_ready":
      return 6;
    case "pullback_ready":
      return 5;
    case "breakout_extended":
      return 2;
    case "pullback_deep":
      return 3;
    case "pullback_early":
      return 4;
    case "pivot_formed":
      return 1;
    case "broken":
      return 0;
    default:
      return 0;
  }
}

export function toSignal(score: number): SmartMoneyPatternMatch["signal"] {
  if (score >= 85) {
    return "explosive";
  }
  if (score >= 65) {
    return "strong";
  }
  return "watch";
}

export function resolveWorkflowStatus(params: {
  stage: SmartMoneyPatternMatch["stage"];
  matched: boolean;
  actionable: boolean;
  referenceClose: number;
  breakoutLevel?: number;
  invalidationPrice?: number;
  referenceCloseVsBreakoutLevelPercent?: number;
  pullbackSessions: number;
  sessionsSinceBreakout?: number;
  minSetupPullbackSessions: number;
  breakoutHoldTolerancePercent: number;
  maxBreakoutExtensionPercent: number;
}) {
  const { breakoutLevel, invalidationPrice, referenceClose } = params;
  const distance = params.referenceCloseVsBreakoutLevelPercent ?? -100;
  if (invalidationPrice != null && referenceClose < invalidationPrice) {
    return "broken" as const;
  }

  if (
    params.stage === "breakout" &&
    breakoutLevel != null &&
    referenceClose < breakoutLevel * (1 - params.breakoutHoldTolerancePercent / 100)
  ) {
    return "broken" as const;
  }

  if (params.stage === "breakout") {
    if (params.matched && params.actionable) {
      return "breakout_confirmed" as const;
    }
    if (distance > params.maxBreakoutExtensionPercent) {
      return "breakout_extended" as const;
    }
    return "breakout_ready" as const;
  }

  if (params.stage === "setup") {
    if (!params.matched) {
      return "pivot_formed" as const;
    }
    if (params.pullbackSessions < params.minSetupPullbackSessions + 1) {
      return "pullback_early" as const;
    }
    if (params.actionable) {
      return "buy_ready" as const;
    }
    if (distance > params.maxBreakoutExtensionPercent) {
      return "breakout_extended" as const;
    }
    if (distance > 1.5) {
      return "breakout_ready" as const;
    }
    if (distance >= -8) {
      return "pullback_ready" as const;
    }
    return "pullback_deep" as const;
  }

  return "none" as const;
}
