import { config } from "../config.js";
import type { RealTimePriceSpikeEvent } from "../types.js";

type AlertSignal = "watch" | "strong" | "explosive";

type AlertThresholds = {
  minChangePercent: number;
  minVolumeRatio: number;
  minTurnoverKrw: number;
  requireBreakout: boolean;
  cooldownMs: number;
};

type AlertDecision = {
  accepted: boolean;
  shouldSend: boolean;
  deduped: boolean;
  signal: AlertSignal;
  score: number;
  reasons: string[];
  summary: string;
  event: RealTimePriceSpikeEvent & {
    changePercent?: number;
    turnoverKrw?: number;
  };
};

type DedupeState = {
  lastSentAt: number;
  signalRank: number;
  score: number;
  changePercent?: number;
};

const dedupeStore = new Map<string, DedupeState>();

function formatDetectedAt(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rankSignal(signal: AlertSignal): number {
  if (signal === "explosive") {
    return 3;
  }
  if (signal === "strong") {
    return 2;
  }
  return 1;
}

function computeChangePercent(event: RealTimePriceSpikeEvent): number | undefined {
  if (typeof event.changePercent === "number") {
    return event.changePercent;
  }
  if (typeof event.previousClose === "number" && event.previousClose !== 0) {
    return ((event.price - event.previousClose) / event.previousClose) * 100;
  }
  return undefined;
}

function computeTurnover(event: RealTimePriceSpikeEvent): number | undefined {
  if (typeof event.turnoverKrw === "number") {
    return event.turnoverKrw;
  }
  if (typeof event.volume === "number") {
    return event.price * event.volume;
  }
  return undefined;
}

function buildThresholds(overrides?: Partial<AlertThresholds>): AlertThresholds {
  return {
    minChangePercent: overrides?.minChangePercent ?? config.alertMinChangePercent,
    minVolumeRatio: overrides?.minVolumeRatio ?? config.alertMinVolumeRatio,
    minTurnoverKrw: overrides?.minTurnoverKrw ?? config.alertMinTurnoverKrw,
    requireBreakout: overrides?.requireBreakout ?? config.alertRequireBreakout,
    cooldownMs: overrides?.cooldownMs ?? config.alertCooldownMs
  };
}

function summarizeReasons(reasons: string[]): string {
  return reasons.length ? reasons.join(", ") : "Spike did not pass the alert thresholds.";
}

function cleanupDedupeStore(now: number, cooldownMs: number) {
  for (const [key, value] of dedupeStore.entries()) {
    if (now - value.lastSentAt > Math.max(cooldownMs * 6, 60 * 60 * 1000)) {
      dedupeStore.delete(key);
    }
  }
}

export function evaluateRealTimePriceSpike(
  input: RealTimePriceSpikeEvent,
  overrides?: Partial<AlertThresholds>
): AlertDecision {
  const thresholds = buildThresholds(overrides);
  const changePercent = computeChangePercent(input);
  const turnoverKrw = computeTurnover(input);
  const breakout20d = input.breakout20d === true;
  const breakout60d = input.breakout60d === true;
  const normalizedEvent = {
    ...input,
    changePercent,
    turnoverKrw,
    detectedAt: formatDetectedAt(input.detectedAt)
  };

  let score = 0;
  const reasons: string[] = [];

  if (typeof changePercent === "number" && changePercent >= thresholds.minChangePercent) {
    if (changePercent >= 20) {
      score += 40;
    } else if (changePercent >= 12) {
      score += 30;
    } else {
      score += 20;
    }
    reasons.push(`등락률 ${changePercent.toFixed(2)}%`);
  }

  if (typeof normalizedEvent.volumeRatio20d === "number" && normalizedEvent.volumeRatio20d >= thresholds.minVolumeRatio) {
    if (normalizedEvent.volumeRatio20d >= 8) {
      score += 30;
    } else if (normalizedEvent.volumeRatio20d >= 5) {
      score += 24;
    } else {
      score += 18;
    }
    reasons.push(`거래량 ${normalizedEvent.volumeRatio20d.toFixed(1)}배`);
  }

  if (typeof turnoverKrw === "number" && turnoverKrw >= thresholds.minTurnoverKrw) {
    if (turnoverKrw >= 30_000_000_000) {
      score += 15;
    } else {
      score += 10;
    }
    reasons.push(`거래대금 ${(turnoverKrw / 100_000_000).toFixed(0)}억`);
  }

  if (breakout60d) {
    score += 18;
    reasons.push("60일 고점 돌파");
  } else if (breakout20d) {
    score += 12;
    reasons.push("20일 고점 돌파");
  }

  if (typeof input.high === "number" && input.high > 0 && input.price >= input.high * 0.985) {
    score += 8;
    reasons.push("고가 부근 유지");
  }

  score = clamp(score, 0, 100);

  let signal: AlertSignal = "watch";
  if (score >= 80) {
    signal = "explosive";
  } else if (score >= 55) {
    signal = "strong";
  }

  const meetsChange = typeof changePercent === "number" && changePercent >= thresholds.minChangePercent;
  const meetsVolume =
    typeof normalizedEvent.volumeRatio20d === "number" && normalizedEvent.volumeRatio20d >= thresholds.minVolumeRatio;
  const meetsTurnover = typeof turnoverKrw === "number" && turnoverKrw >= thresholds.minTurnoverKrw;
  const meetsBreakout = !thresholds.requireBreakout || breakout20d || breakout60d;
  const accepted = meetsChange && meetsVolume && meetsTurnover && meetsBreakout;

  if (!accepted) {
    const failureReasons: string[] = [];
    if (!meetsChange) {
      failureReasons.push(`등락률 ${thresholds.minChangePercent}% 미만`);
    }
    if (!meetsVolume) {
      failureReasons.push(`거래량 ${thresholds.minVolumeRatio}배 미만`);
    }
    if (!meetsTurnover) {
      failureReasons.push(`거래대금 ${Math.round(thresholds.minTurnoverKrw / 100_000_000)}억 미만`);
    }
    if (!meetsBreakout) {
      failureReasons.push("돌파 조건 미충족");
    }

    return {
      accepted: false,
      shouldSend: false,
      deduped: false,
      signal,
      score,
      reasons: failureReasons,
      summary: summarizeReasons(failureReasons),
      event: normalizedEvent
    };
  }

  const now = Date.now();
  cleanupDedupeStore(now, thresholds.cooldownMs);

  const key = normalizedEvent.symbol.toUpperCase();
  const previous = dedupeStore.get(key);
  const signalRank = rankSignal(signal);
  let deduped = false;

  if (previous) {
    const withinCooldown = now - previous.lastSentAt < thresholds.cooldownMs;
    const strongerSignal = signalRank > previous.signalRank;
    const materiallyHigherScore = score >= previous.score + 15;
    const materiallyHigherChange =
      typeof changePercent === "number" &&
      typeof previous.changePercent === "number" &&
      changePercent >= previous.changePercent + 3;

    if (withinCooldown && !strongerSignal && !materiallyHigherScore && !materiallyHigherChange) {
      deduped = true;
    }
  }

  if (!deduped) {
    dedupeStore.set(key, {
      lastSentAt: now,
      signalRank,
      score,
      changePercent
    });
  }

  return {
    accepted: true,
    shouldSend: !deduped,
    deduped,
    signal,
    score,
    reasons,
    summary: summarizeReasons(reasons),
    event: normalizedEvent
  };
}
