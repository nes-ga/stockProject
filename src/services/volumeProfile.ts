import type {
  AdvancedVolumeProfile,
  ChartPoint,
  LongTermVolumeProfileAnalysis,
  SwingVolumeProfileAnalysis,
  VolumeProfileCandle,
  VolumeProfileResult,
  VolumeProfileVacuumZone
} from "../types.js";

export type Candle = VolumeProfileCandle;

type VolumeProfileMap = Map<number, number>;

type VolumeProfileBuildOptions = {
  timeWeighted?: boolean;
  decayFactor?: number;
  weightedBodyDistribution?: boolean;
  gapAwareProfile?: boolean;
};

type VolumeProfileEvaluationOptions = VolumeProfileBuildOptions & {
  lookbackDays?: number;
  currentPrice?: number;
  binSize?: number;
  rangeRate?: number;
  distanceWeighted?: boolean;
  distanceMultiplier?: number;
  minReliabilityLookback?: number;
};

type SwingCrossCheckInput = {
  trendScore?: number;
  volumeScore?: number;
  themeScore?: number;
  marketCycleScore?: number;
  pullbackScore?: number;
  riskScore?: number;
};

type LongTermCrossCheckInput = {
  trendScore?: number;
  financialScore?: number;
  liquidityScore?: number;
  marketCycleScore?: number;
};

type BuildProfileResult = {
  profile: VolumeProfileMap;
  vacuumZones: VolumeProfileVacuumZone[];
};

type RetestEvaluation = {
  retestSuccessScore: number;
  retestFailureRisk: number;
  retestDetected: boolean;
  summary?: string;
};

function isFinitePositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundLevel(value: number) {
  return Math.round(value * 10000) / 10000;
}

function roundNumber(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function percentChange(current: number, previous?: number) {
  if (!isFinitePositive(previous)) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampScore(score: number, min: number, max: number) {
  return clamp(Math.round(score), min, max);
}

export function toVolumeProfileCandles(points: ChartPoint[]): Candle[] {
  return points
    .map((point) => {
      const close = point.close;
      const high = point.high ?? close;
      const low = point.low ?? close;
      const open = point.open ?? close;
      const volume = point.volume ?? 0;
      if (![open, high, low, close, volume].every((value) => Number.isFinite(value)) || close <= 0 || high <= 0 || low <= 0 || volume <= 0) {
        return undefined;
      }

      return {
        date: point.date,
        open,
        high: Math.max(high, low),
        low: Math.min(high, low),
        close,
        volume
      };
    })
    .filter((point): point is Candle => Boolean(point));
}

function calculateAtr(candles: Candle[], period = 14): number | undefined {
  if (candles.length < period + 1) {
    return undefined;
  }

  const trueRanges: number[] = [];
  for (let index = candles.length - period; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1]?.close ?? candle.close;
    trueRanges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose)
      )
    );
  }

  return average(trueRanges);
}

function resolveDynamicBinSize(candles: Candle[], currentPrice: number, explicitBinSize?: number) {
  const atr14 = calculateAtr(candles, 14);
  const rawBinSize = explicitBinSize && explicitBinSize > 0
    ? explicitBinSize
    : Math.max(currentPrice * 0.005, (atr14 ?? currentPrice * 0.01) * 0.25);
  const dynamicBinSize = clamp(rawBinSize, currentPrice * 0.003, currentPrice * 0.02);

  return {
    atr14,
    dynamicBinSize
  };
}

function emptyAdvancedProfile(lookbackDays: number, comment: string): AdvancedVolumeProfile {
  return {
    dynamicBinSize: 0,
    timeWeighted: false,
    decayFactor: 0,
    weightedBodyDistribution: false,
    distanceWeighted: false,
    retestSuccessScore: 0,
    retestFailureRisk: 0,
    retestDetected: false,
    gapAwareProfile: false,
    vacuumZones: [],
    profileReliability: lookbackDays >= 10 ? 40 : 0,
    reliabilityWarnings: ["insufficient_volume_profile_data"],
    summary: comment
  };
}

function emptyVolumeProfileResult(lookbackDays: number, comment = "매물대 계산에 필요한 일봉 거래량 데이터가 부족합니다."): VolumeProfileResult {
  const advancedVolumeProfile = emptyAdvancedProfile(lookbackDays, comment);
  return {
    lookbackDays,
    overheadVolume: 0,
    supportVolume: 0,
    supplyRatio: 0,
    supplyScore: 0,
    breakoutScore: 0,
    totalScore: 0,
    resistanceZones: [],
    supportZones: [],
    dynamicBinSize: 0,
    timeWeighted: false,
    decayFactor: 0,
    weightedBodyDistribution: false,
    distanceWeighted: false,
    retestSuccessScore: 0,
    retestFailureRisk: 0,
    retestDetected: false,
    gapAwareProfile: false,
    vacuumZones: [],
    profileReliability: advancedVolumeProfile.profileReliability,
    reliabilityWarnings: advancedVolumeProfile.reliabilityWarnings,
    advancedVolumeProfile,
    comment
  };
}

function addVolumeToRange(profile: VolumeProfileMap, low: number, high: number, volume: number, binSize: number) {
  if (!isFinitePositive(volume) || !isFinitePositive(binSize)) {
    return;
  }

  const normalizedLow = Math.min(low, high);
  const normalizedHigh = Math.max(low, high);
  const startIndex = Math.floor(normalizedLow / binSize);
  const endIndex = Math.floor(normalizedHigh / binSize);
  const binCount = Math.max(1, endIndex - startIndex + 1);
  const volumePerBin = volume / binCount;

  for (let binIndex = startIndex; binIndex <= endIndex; binIndex += 1) {
    const level = roundLevel(binIndex * binSize);
    profile.set(level, (profile.get(level) ?? 0) + volumePerBin);
  }
}

function getBodyVolumeShare(candle: Candle) {
  const range = Math.max(candle.high - candle.low, candle.close * 0.001);
  const body = Math.abs(candle.close - candle.open);
  const bodyRatio = body / range;
  if (bodyRatio <= 0.12) {
    return 0.45;
  }
  const baseShare = candle.close >= candle.open ? 0.7 : 0.65;
  return clamp(baseShare + Math.max(0, bodyRatio - 0.55) * 0.15, 0.55, 0.82);
}

function distributeCandleVolume(profile: VolumeProfileMap, candle: Candle, weightedVolume: number, binSize: number, weightedBodyDistribution: boolean) {
  if (!weightedBodyDistribution) {
    addVolumeToRange(profile, candle.low, candle.high, weightedVolume, binSize);
    return;
  }

  const bodyLow = Math.min(candle.open, candle.close);
  const bodyHigh = Math.max(candle.open, candle.close);
  const range = Math.max(candle.high - candle.low, candle.close * 0.001);
  const body = bodyHigh - bodyLow;
  if (body / range <= 0.08) {
    addVolumeToRange(profile, candle.low, candle.high, weightedVolume, binSize);
    return;
  }

  const bodyShare = getBodyVolumeShare(candle);
  const upperShare = candle.close >= candle.open ? (1 - bodyShare) * 0.5 : (1 - bodyShare) * 0.57;
  const lowerShare = Math.max(0, 1 - bodyShare - upperShare);

  addVolumeToRange(profile, bodyLow, bodyHigh, weightedVolume * bodyShare, binSize);
  if (candle.high > bodyHigh) {
    addVolumeToRange(profile, bodyHigh, candle.high, weightedVolume * upperShare, binSize);
  }
  if (bodyLow > candle.low) {
    addVolumeToRange(profile, candle.low, bodyLow, weightedVolume * lowerShare, binSize);
  }
}

function detectVacuumZone(previousClose: number | undefined, candle: Candle): VolumeProfileVacuumZone | undefined {
  if (!isFinitePositive(previousClose)) {
    return undefined;
  }

  const gapRate = Math.abs(candle.open - previousClose) / previousClose;
  if (gapRate < 0.015) {
    return undefined;
  }

  return {
    start: roundNumber(Math.min(previousClose, candle.open), 4),
    end: roundNumber(Math.max(previousClose, candle.open), 4)
  };
}

function removeGapVacuumFromDistribution(candle: Candle, previousClose: number | undefined, vacuumZone?: VolumeProfileVacuumZone): Candle {
  if (!vacuumZone || !isFinitePositive(previousClose)) {
    return candle;
  }

  if (candle.open > previousClose) {
    const floor = candle.open;
    return {
      ...candle,
      low: Math.max(candle.low, floor),
      open: Math.max(candle.open, floor),
      close: Math.max(candle.close, floor),
      high: Math.max(candle.high, floor)
    };
  }

  const ceiling = candle.open;
  return {
    ...candle,
    low: Math.min(candle.low, ceiling),
    open: Math.min(candle.open, ceiling),
    close: Math.min(candle.close, ceiling),
    high: Math.min(candle.high, ceiling)
  };
}

export function buildVolumeProfile(candles: Candle[], binSize: number, options: VolumeProfileBuildOptions = {}): VolumeProfileMap {
  return buildVolumeProfileWithMeta(candles, binSize, options).profile;
}

function buildVolumeProfileWithMeta(candles: Candle[], binSize: number, options: VolumeProfileBuildOptions = {}): BuildProfileResult {
  const profile: VolumeProfileMap = new Map();
  const vacuumZones: VolumeProfileVacuumZone[] = [];
  if (!isFinitePositive(binSize)) {
    return { profile, vacuumZones };
  }

  const decayFactor = Math.max(1, options.decayFactor ?? candles.length);
  for (const [index, candle] of candles.entries()) {
    if (!isFinitePositive(candle.volume) || !isFinitePositive(candle.close)) {
      continue;
    }

    const previousClose = candles[index - 1]?.close;
    let vacuumZone: VolumeProfileVacuumZone | undefined;
    if (options.gapAwareProfile) {
      vacuumZone = detectVacuumZone(previousClose, candle);
      if (vacuumZone) {
        vacuumZones.push(vacuumZone);
      }
    }

    const daysAgo = candles.length - 1 - index;
    const timeWeight = options.timeWeighted ? Math.exp(-daysAgo / decayFactor) : 1;
    const distributionCandle = removeGapVacuumFromDistribution(candle, previousClose, vacuumZone);
    distributeCandleVolume(profile, distributionCandle, candle.volume * timeWeight, binSize, Boolean(options.weightedBodyDistribution));
  }

  return { profile, vacuumZones };
}

export function findMajorVolumeZones(profile: VolumeProfileMap): number[] {
  const entries = [...profile.entries()].filter(([, volume]) => volume > 0);
  if (!entries.length) {
    return [];
  }

  const sortedVolumes = entries.map(([, volume]) => volume).sort((left, right) => right - left);
  const cutoffIndex = Math.max(0, Math.ceil(sortedVolumes.length * 0.2) - 1);
  const cutoffVolume = sortedVolumes[cutoffIndex] ?? sortedVolumes[0];

  return entries
    .filter(([, volume]) => volume >= cutoffVolume)
    .map(([price]) => price)
    .sort((left, right) => left - right);
}

function getDistanceWeight(price: number, currentPrice: number, multiplier: number) {
  const distancePercent = Math.abs(price - currentPrice) / currentPrice;
  return 1 / (1 + distancePercent * multiplier);
}

export function calculateOverheadSupply(profile: VolumeProfileMap, currentPrice: number, rangeRate = 0.1, options?: {
  distanceWeighted?: boolean;
  distanceMultiplier?: number;
}) {
  const lowerBound = currentPrice * (1 - rangeRate);
  const upperBound = currentPrice * (1 + rangeRate);
  const multiplier = options?.distanceMultiplier ?? 0;
  let overheadVolume = 0;
  let supportVolume = 0;

  for (const [price, volume] of profile.entries()) {
    const adjustedVolume = options?.distanceWeighted ? volume * getDistanceWeight(price, currentPrice, multiplier) : volume;
    if (price > currentPrice && price <= upperBound) {
      overheadVolume += adjustedVolume;
    } else if (price <= currentPrice && price >= lowerBound) {
      supportVolume += adjustedVolume;
    }
  }

  return {
    overheadVolume,
    supportVolume,
    supplyRatio: overheadVolume / Math.max(1, supportVolume)
  };
}

export function scoreSupplyPressure(supplyRatio: number) {
  if (supplyRatio >= 2) {
    return -20;
  }
  if (supplyRatio >= 1.5) {
    return -12;
  }
  if (supplyRatio >= 1) {
    return -5;
  }
  if (supplyRatio >= 0.7) {
    return 3;
  }
  return 8;
}

export function scoreBreakoutAbsorption(candles: Candle[], nearestMajorVolumePrice?: number) {
  if (!isFinitePositive(nearestMajorVolumePrice)) {
    return 0;
  }

  const recent = candles.slice(-5);
  if (recent.length < 3) {
    return 0;
  }

  const averageVolume60 =
    average(candles.slice(Math.max(0, candles.length - 65), Math.max(0, candles.length - 5)).map((candle) => candle.volume)) ??
    average(candles.slice(-60).map((candle) => candle.volume));
  const closeAboveCount = recent.filter((candle) => candle.close > nearestMajorVolumePrice).length;
  const hasVolumeSpike =
    averageVolume60 != null && averageVolume60 > 0 && recent.some((candle) => candle.volume >= averageVolume60 * 1.8);

  if (closeAboveCount >= 4 && hasVolumeSpike) {
    return 15;
  }
  if (closeAboveCount >= 3) {
    return 8;
  }
  if (closeAboveCount <= 1) {
    return -10;
  }
  return 0;
}

function evaluateRetest(candles: Candle[], level?: number): RetestEvaluation {
  if (!isFinitePositive(level) || candles.length < 12) {
    return {
      retestSuccessScore: 0,
      retestFailureRisk: 0,
      retestDetected: false
    };
  }

  const avgVolume20 = average(candles.slice(-35, -5).map((candle) => candle.volume)) ?? average(candles.slice(-20).map((candle) => candle.volume)) ?? 0;
  const recent = candles.slice(-12);
  const breakoutIndex = recent.findIndex((candle) => candle.close > level * 1.01 && candle.volume >= avgVolume20 * 1.2);
  const breakout = breakoutIndex >= 0 ? recent[breakoutIndex] : undefined;
  if (!breakout) {
    const failedReentry = recent.some((candle) => candle.high > level && candle.close < level && candle.volume >= avgVolume20 * 1.2);
    return {
      retestSuccessScore: 0,
      retestFailureRisk: failedReentry ? -8 : 0,
      retestDetected: failedReentry,
      summary: failedReentry ? "주요 매물대 돌파 후 재진입이 발생해 실패 가능성이 존재합니다." : undefined
    };
  }

  const afterBreakout = recent.slice(breakoutIndex + 1);
  const retest = afterBreakout.find((candle) => candle.low <= level * 1.02 && candle.close >= level * 0.995);
  const belowClose = afterBreakout.find((candle) => candle.close < level * 0.99);
  const distributionCandle = afterBreakout.find((candle) => candle.close < candle.open && candle.volume >= avgVolume20 * 1.3);
  const upperWickCount = afterBreakout.filter((candle) => {
    const range = candle.high - candle.low;
    return range > 0 && (candle.high - Math.max(candle.open, candle.close)) / range >= 0.35;
  }).length;

  if (belowClose || distributionCandle || upperWickCount >= 3) {
    return {
      retestSuccessScore: 0,
      retestFailureRisk: belowClose ? -15 : -10,
      retestDetected: true,
      summary: "주요 매물대 돌파 후 재진입이 발생해 실패 가능성이 존재합니다."
    };
  }

  if (retest) {
    const retestVolumeContracted = retest.volume <= breakout.volume * 0.75;
    const rebound = afterBreakout.slice(afterBreakout.indexOf(retest) + 1).find((candle) => candle.close > retest.close && candle.volume >= retest.volume * 1.2);
    return {
      retestSuccessScore: retestVolumeContracted && rebound ? 10 : retestVolumeContracted ? 6 : 3,
      retestFailureRisk: 0,
      retestDetected: true,
      summary: "돌파 후 거래량 감소 눌림이 발생했으며 주요 매물대 위에서 종가 방어 중입니다."
    };
  }

  return {
    retestSuccessScore: 0,
    retestFailureRisk: 0,
    retestDetected: false
  };
}

function resolveRetestReferencePrice(majorZones: number[], currentPrice: number, fallback?: number) {
  const breakoutBase = majorZones
    .filter((price) => price <= currentPrice * 0.985 && price >= currentPrice * 0.88)
    .sort((left, right) => right - left)[0];
  return breakoutBase ?? fallback;
}

function resolveNextZones(majorZones: number[], currentPrice: number) {
  const nextResistance = majorZones.find((price) => price > currentPrice);
  const nextSupport = [...majorZones].reverse().find((price) => price <= currentPrice);
  const upsideToResistance = nextResistance != null ? (nextResistance - currentPrice) / currentPrice : undefined;
  const downsideToSupport = nextSupport != null ? (currentPrice - nextSupport) / currentPrice : undefined;
  const rewardRiskRatio =
    upsideToResistance != null && downsideToSupport != null && downsideToSupport > 0
      ? upsideToResistance / downsideToSupport
      : undefined;

  return {
    nextResistance,
    nextSupport,
    upsideToResistance,
    downsideToSupport,
    rewardRiskRatio,
    nearestResistanceDistance: upsideToResistance,
    nearestSupportDistance: downsideToSupport
  };
}

function calculatePocAndValueArea(profile: VolumeProfileMap) {
  const entries = [...profile.entries()].filter(([, volume]) => volume > 0).sort((left, right) => left[0] - right[0]);
  if (!entries.length) {
    return {};
  }

  const totalVolume = entries.reduce((sum, [, volume]) => sum + volume, 0);
  const pocEntry = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0]);
  let selectedVolume = pocEntry[1];
  let lowIndex = entries.findIndex(([price]) => price === pocEntry[0]);
  let highIndex = lowIndex;

  while (selectedVolume < totalVolume * 0.7 && (lowIndex > 0 || highIndex < entries.length - 1)) {
    const lowerVolume = lowIndex > 0 ? entries[lowIndex - 1][1] : -1;
    const upperVolume = highIndex < entries.length - 1 ? entries[highIndex + 1][1] : -1;
    if (upperVolume >= lowerVolume) {
      highIndex += 1;
      selectedVolume += entries[highIndex][1];
    } else {
      lowIndex -= 1;
      selectedVolume += entries[lowIndex][1];
    }
  }

  return {
    pocPrice: pocEntry[0],
    valueAreaLow: entries[lowIndex][0],
    valueAreaHigh: entries[highIndex][0]
  };
}

function assessProfileReliability(candles: Candle[], vacuumZones: VolumeProfileVacuumZone[], minReliabilityLookback: number) {
  let profileReliability = 100;
  const reliabilityWarnings: string[] = [];
  if (candles.length < minReliabilityLookback) {
    profileReliability -= 30;
    reliabilityWarnings.push("data_lookback_short");
  }
  if (candles.length < 60) {
    profileReliability -= 20;
    reliabilityWarnings.push("very_short_daily_history");
  }
  if (vacuumZones.length >= 3) {
    profileReliability -= 12;
    reliabilityWarnings.push("multiple_gap_vacuum_zones");
  }

  const avgVolume = average(candles.map((candle) => candle.volume)) ?? 0;
  const latestPrice = candles.at(-1)?.close ?? 0;
  const avgTurnover = avgVolume * latestPrice;
  if (avgTurnover > 0 && avgTurnover < 1_000_000_000) {
    profileReliability -= 15;
    reliabilityWarnings.push("thin_average_turnover");
  }

  const recent = candles.slice(-20);
  const prior = candles.slice(Math.max(0, candles.length - 80), Math.max(0, candles.length - 20));
  const recentVolume = average(recent.map((candle) => candle.volume)) ?? 0;
  const priorVolume = average(prior.map((candle) => candle.volume)) ?? recentVolume;
  if (priorVolume > 0 && recentVolume >= priorVolume * 4) {
    profileReliability -= 12;
    reliabilityWarnings.push("recent_volume_regime_shift");
  }

  const suspiciousSplitLikeMove = candles.slice(-30).some((candle, index, array) => {
    const previous = index > 0 ? array[index - 1] : undefined;
    return previous != null && Math.abs(percentChange(candle.close, previous.close) ?? 0) >= 35 && candle.volume >= previous.volume * 2;
  });
  if (suspiciousSplitLikeMove) {
    profileReliability -= 20;
    reliabilityWarnings.push("possible_split_or_capital_action");
  }

  return {
    profileReliability: clampScore(profileReliability, 0, 100),
    reliabilityWarnings: [...new Set(reliabilityWarnings)]
  };
}

export function generateVolumeProfileComment(result: VolumeProfileResult) {
  const comments: string[] = [];

  if (result.lookbackDays <= 0) {
    return "매물대 계산에 필요한 일봉 거래량 데이터가 부족합니다.";
  }

  if (result.supplyRatio >= 1.5) {
    comments.push("현재가 위 매물이 두꺼워 추격매수 위험이 있습니다.");
  } else if (result.supplyRatio < 0.7 && result.supportVolume > result.overheadVolume) {
    comments.push("현재가 아래 매물대가 두꺼워 단기 지지 가능성이 있습니다.");
  } else {
    comments.push("현재가 주변 위/아래 매물 부담은 중립권입니다.");
  }

  if ((result.retestSuccessScore ?? 0) > 0) {
    comments.push("돌파 후 거래량 감소 눌림이 발생했으며 주요 매물대 위에서 종가 방어 중입니다.");
  } else if ((result.retestFailureRisk ?? 0) < 0) {
    comments.push("주요 매물대 돌파 후 재진입이 발생해 실패 가능성이 존재합니다.");
  } else if (result.breakoutScore >= 15) {
    comments.push("주요 매물대를 거래량 동반 돌파 후 안착 중입니다.");
  } else if (result.breakoutScore >= 8) {
    comments.push("주요 매물대 위에서 일부 안착 흐름이 확인됩니다.");
  } else if (result.breakoutScore <= -10) {
    comments.push("주요 매물대 돌파 실패 가능성이 있어 윗꼬리 리스크가 있습니다.");
  }

  if ((result.upsideToResistance ?? 1) < 0.05) {
    comments.push("다음 주요 매물대까지 기대 여력이 제한적입니다.");
  } else if ((result.rewardRiskRatio ?? 0) >= 1.5) {
    comments.push("상방 기대 여력 대비 하방 위험 비율이 양호합니다.");
  }

  if ((result.profileReliability ?? 100) < 60) {
    comments.push("매물대 신뢰도가 낮아 해석을 보수적으로 제한합니다.");
  }

  return comments.join(" ");
}

function evaluateVolumeProfile(candles: Candle[], options: VolumeProfileEvaluationOptions = {}): VolumeProfileResult {
  const lookbackDays = options.lookbackDays ?? 120;
  const scopedCandles = candles.slice(-lookbackDays);
  const latestClose = options.currentPrice ?? scopedCandles.at(-1)?.close;
  if (!isFinitePositive(latestClose) || scopedCandles.length < 10) {
    return emptyVolumeProfileResult(scopedCandles.length);
  }

  const { atr14, dynamicBinSize } = resolveDynamicBinSize(scopedCandles, latestClose, options.binSize);
  const profileMeta = buildVolumeProfileWithMeta(scopedCandles, dynamicBinSize, {
    timeWeighted: options.timeWeighted ?? true,
    decayFactor: options.decayFactor ?? scopedCandles.length,
    weightedBodyDistribution: options.weightedBodyDistribution ?? true,
    gapAwareProfile: options.gapAwareProfile ?? true
  });
  if (!profileMeta.profile.size) {
    return emptyVolumeProfileResult(scopedCandles.length);
  }

  const majorZones = findMajorVolumeZones(profileMeta.profile);
  const nearestMajorVolumePrice = majorZones.length
    ? majorZones.reduce((nearest, price) => (Math.abs(price - latestClose) < Math.abs(nearest - latestClose) ? price : nearest), majorZones[0])
    : undefined;
  const resistanceZones = majorZones.filter((price) => price > latestClose);
  const supportZones = majorZones.filter((price) => price <= latestClose).sort((left, right) => right - left);
  const supply = calculateOverheadSupply(profileMeta.profile, latestClose, options.rangeRate ?? 0.1, {
    distanceWeighted: options.distanceWeighted ?? true,
    distanceMultiplier: options.distanceMultiplier ?? 8
  });
  const supplyScore = scoreSupplyPressure(supply.supplyRatio);
  const breakoutScore = scoreBreakoutAbsorption(scopedCandles, nearestMajorVolumePrice);
  const retestReferencePrice = resolveRetestReferencePrice(majorZones, latestClose, nearestMajorVolumePrice);
  const retest = evaluateRetest(scopedCandles, retestReferencePrice);
  const nextZones = resolveNextZones(majorZones, latestClose);
  const valueArea = calculatePocAndValueArea(profileMeta.profile);
  const reliability = assessProfileReliability(scopedCandles, profileMeta.vacuumZones, options.minReliabilityLookback ?? Math.min(lookbackDays, 120));
  const rewardRiskPenalty =
    nextZones.rewardRiskRatio != null && nextZones.rewardRiskRatio < 1
      ? -6
      : nextZones.upsideToResistance != null && nextZones.upsideToResistance < 0.05
        ? -5
        : 0;
  const reliabilityScale = reliability.profileReliability < 60 ? 0.45 : reliability.profileReliability < 75 ? 0.7 : 1;
  const positiveScore = Math.max(0, supplyScore + breakoutScore + retest.retestSuccessScore);
  const negativeScore = Math.min(0, supplyScore + retest.retestFailureRisk + rewardRiskPenalty);
  const rawTotalScore = positiveScore * reliabilityScale + negativeScore;

  const preliminary: VolumeProfileResult = {
    lookbackDays: scopedCandles.length,
    overheadVolume: Math.round(supply.overheadVolume),
    supportVolume: Math.round(supply.supportVolume),
    supplyRatio: roundNumber(supply.supplyRatio, 2),
    supplyScore,
    breakoutScore,
    totalScore: clampScore(rawTotalScore, -20, 25),
    nearestMajorVolumePrice,
    resistanceZones: resistanceZones.slice(0, 5),
    supportZones: supportZones.slice(0, 5),
    dynamicBinSize: roundNumber(dynamicBinSize, 4),
    atr14: atr14 == null ? undefined : roundNumber(atr14, 4),
    timeWeighted: options.timeWeighted ?? true,
    decayFactor: options.decayFactor ?? scopedCandles.length,
    weightedBodyDistribution: options.weightedBodyDistribution ?? true,
    distanceWeighted: options.distanceWeighted ?? true,
    nearestResistanceDistance: nextZones.nearestResistanceDistance == null ? undefined : roundNumber(nextZones.nearestResistanceDistance, 4),
    nearestSupportDistance: nextZones.nearestSupportDistance == null ? undefined : roundNumber(nextZones.nearestSupportDistance, 4),
    retestSuccessScore: retest.retestSuccessScore,
    retestFailureRisk: retest.retestFailureRisk,
    retestDetected: retest.retestDetected,
    nextResistance: nextZones.nextResistance,
    nextSupport: nextZones.nextSupport,
    upsideToResistance: nextZones.upsideToResistance == null ? undefined : roundNumber(nextZones.upsideToResistance, 4),
    downsideToSupport: nextZones.downsideToSupport == null ? undefined : roundNumber(nextZones.downsideToSupport, 4),
    rewardRiskRatio: nextZones.rewardRiskRatio == null ? undefined : roundNumber(nextZones.rewardRiskRatio, 2),
    gapAwareProfile: options.gapAwareProfile ?? true,
    vacuumZones: profileMeta.vacuumZones.slice(-8),
    pocPrice: valueArea.pocPrice,
    valueAreaHigh: valueArea.valueAreaHigh,
    valueAreaLow: valueArea.valueAreaLow,
    profileReliability: reliability.profileReliability,
    reliabilityWarnings: reliability.reliabilityWarnings,
    comment: ""
  };
  const comment = generateVolumeProfileComment(preliminary);
  const advancedVolumeProfile: AdvancedVolumeProfile = {
    dynamicBinSize: preliminary.dynamicBinSize ?? 0,
    atr14: preliminary.atr14,
    timeWeighted: preliminary.timeWeighted ?? true,
    decayFactor: preliminary.decayFactor ?? scopedCandles.length,
    weightedBodyDistribution: preliminary.weightedBodyDistribution ?? true,
    distanceWeighted: preliminary.distanceWeighted ?? true,
    nearestResistanceDistance: preliminary.nearestResistanceDistance,
    nearestSupportDistance: preliminary.nearestSupportDistance,
    retestSuccessScore: preliminary.retestSuccessScore ?? 0,
    retestFailureRisk: preliminary.retestFailureRisk ?? 0,
    retestDetected: preliminary.retestDetected ?? false,
    nextResistance: preliminary.nextResistance,
    nextSupport: preliminary.nextSupport,
    upsideToResistance: preliminary.upsideToResistance,
    downsideToSupport: preliminary.downsideToSupport,
    rewardRiskRatio: preliminary.rewardRiskRatio,
    gapAwareProfile: preliminary.gapAwareProfile ?? true,
    vacuumZones: preliminary.vacuumZones ?? [],
    pocPrice: preliminary.pocPrice,
    valueAreaHigh: preliminary.valueAreaHigh,
    valueAreaLow: preliminary.valueAreaLow,
    profileReliability: preliminary.profileReliability ?? 0,
    reliabilityWarnings: preliminary.reliabilityWarnings ?? [],
    summary: comment
  };

  return {
    ...preliminary,
    advancedVolumeProfile,
    comment
  };
}

function hasSupportZoneInPullbackBand(result: VolumeProfileResult, currentPrice: number) {
  const low = currentPrice * 0.92;
  const high = currentPrice * 0.97;
  return result.supportZones.some((price) => price >= low && price <= high);
}

export function analyzeSwingVolumeProfile(points: ChartPoint[], crossCheck: SwingCrossCheckInput = {}): SwingVolumeProfileAnalysis {
  const candles = toVolumeProfileCandles(points);
  const currentPrice = candles.at(-1)?.close;
  if (!isFinitePositive(currentPrice)) {
    const emptyShort = emptyVolumeProfileResult(0);
    const emptyBase = emptyVolumeProfileResult(0);
    return {
      shortTerm: emptyShort,
      baseTerm: emptyBase,
      score: 0,
      chaseRiskBySupply: 0,
      breakoutReliabilityBySupply: 0,
      pullbackSupportQuality: 0,
      advancedVolumeProfile: emptyBase.advancedVolumeProfile,
      summary: "매물대 계산에 필요한 일봉 거래량 데이터가 부족합니다."
    };
  }

  const shortTerm = evaluateVolumeProfile(candles, {
    lookbackDays: 60,
    currentPrice,
    rangeRate: 0.1,
    decayFactor: 24,
    distanceMultiplier: 18,
    minReliabilityLookback: 45
  });
  const baseTerm = evaluateVolumeProfile(candles, {
    lookbackDays: 120,
    currentPrice,
    rangeRate: 0.1,
    decayFactor: 45,
    distanceMultiplier: 14,
    minReliabilityLookback: 80
  });
  const volumeScore = crossCheck.volumeScore ?? 0;
  const pullbackScore = crossCheck.pullbackScore ?? 0;
  const trendScore = crossCheck.trendScore ?? 50;
  const themeScore = crossCheck.themeScore ?? 50;
  const marketCycleScore = crossCheck.marketCycleScore ?? 50;
  const riskScore = crossCheck.riskScore ?? 0;

  let chaseRiskBySupply = 0;
  if (shortTerm.supplyRatio >= 2) {
    chaseRiskBySupply = 26;
  } else if (shortTerm.supplyRatio >= 1.5) {
    chaseRiskBySupply = 18;
  } else if (shortTerm.supplyRatio >= 1) {
    chaseRiskBySupply = 8;
  }
  if ((shortTerm.upsideToResistance ?? 1) < 0.05 || (shortTerm.rewardRiskRatio ?? 2) < 1) {
    chaseRiskBySupply += 8;
  }
  if (themeScore >= 65 && trendScore < 50 && shortTerm.supplyRatio >= 1.5) {
    chaseRiskBySupply += 5;
  }

  const reliabilityScale = (baseTerm.profileReliability ?? 100) < 60 ? 0.45 : (baseTerm.profileReliability ?? 100) < 75 ? 0.7 : 1;
  let breakoutReliabilityBySupply = 0;
  if (baseTerm.breakoutScore > 0 && volumeScore >= 70) {
    breakoutReliabilityBySupply = 10;
  } else if (baseTerm.breakoutScore > 0) {
    breakoutReliabilityBySupply = 5;
  }
  breakoutReliabilityBySupply += Math.min(6, baseTerm.retestSuccessScore ?? 0);
  if (trendScore < 45 || marketCycleScore < 40) {
    breakoutReliabilityBySupply = Math.max(0, breakoutReliabilityBySupply - 6);
  }
  breakoutReliabilityBySupply = Math.round(breakoutReliabilityBySupply * reliabilityScale);

  let pullbackSupportQuality = 0;
  if (hasSupportZoneInPullbackBand(baseTerm, currentPrice)) {
    pullbackSupportQuality = pullbackScore >= 65 ? 12 : pullbackScore >= 50 ? 7 : 3;
  }
  if (trendScore < 40 && pullbackSupportQuality > 0) {
    pullbackSupportQuality = Math.max(0, pullbackSupportQuality - 5);
  }
  pullbackSupportQuality = Math.round(pullbackSupportQuality * reliabilityScale);

  let score =
    Math.min(8, Math.max(0, baseTerm.totalScore)) -
    Math.round(chaseRiskBySupply * 0.9) +
    breakoutReliabilityBySupply +
    pullbackSupportQuality +
    Math.min(0, baseTerm.retestFailureRisk ?? 0);
  if (trendScore < 40 && score > 0) {
    score -= 8;
  }
  if (riskScore >= 60 && score > 0) {
    score -= 6;
  }
  if (marketCycleScore < 40 && score > 0) {
    score -= 5;
  }

  const summaryParts = [baseTerm.comment];
  if (chaseRiskBySupply >= 18) {
    summaryParts.push("현재가 위 단기 매물 또는 제한적인 상방 여력 때문에 추격매수 위험을 높게 봅니다.");
  }
  if (breakoutReliabilityBySupply >= 8) {
    summaryParts.push("거래량 점수와 리테스트/안착 구조가 함께 확인되어 돌파 신뢰도는 보조적으로 개선됩니다.");
  }
  if (pullbackSupportQuality >= 7) {
    summaryParts.push("현재가 아래 3~8% 구간에 매물 지지가 있어 눌림 진입 품질이 양호합니다.");
  }
  if ((baseTerm.profileReliability ?? 100) < 60) {
    summaryParts.push("매물대 신뢰도가 낮아 모든 가산 해석을 축소했습니다.");
  }
  if (trendScore < 45 && baseTerm.totalScore > 0) {
    summaryParts.push("매물대 구조가 양호해도 추세 점수가 낮아 신뢰도는 제한적입니다.");
  }

  return {
    shortTerm,
    baseTerm,
    score: clampScore(score, -20, 25),
    chaseRiskBySupply: clampScore(chaseRiskBySupply, 0, 35),
    breakoutReliabilityBySupply: clampScore(breakoutReliabilityBySupply, 0, 16),
    pullbackSupportQuality: clampScore(pullbackSupportQuality, 0, 18),
    advancedVolumeProfile: baseTerm.advancedVolumeProfile,
    summary: [...new Set(summaryParts)].join(" ")
  };
}

function scoreAccumulationBase(candles: Candle[]) {
  if (candles.length < 120) {
    return 0;
  }

  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const range = high - low;
  if (range <= 0) {
    return 0;
  }

  const lowerThreshold = low + range * 0.4;
  const lowerCandles = candles.filter((candle) => candle.close <= lowerThreshold);
  const avgVolume = average(candles.map((candle) => candle.volume)) ?? 0;
  const heavyLowerCount = lowerCandles.filter((candle) => candle.volume >= avgVolume * 1.1).length;
  const latestClose = candles.at(-1)?.close ?? 0;
  const lowerShare = lowerCandles.length / candles.length;
  const climbedAboveBase = latestClose > lowerThreshold;

  if (lowerShare >= 0.35 && heavyLowerCount >= Math.max(12, lowerCandles.length * 0.25) && climbedAboveBase) {
    return 15;
  }
  if (lowerShare >= 0.2 && heavyLowerCount >= Math.max(6, lowerCandles.length * 0.15) && climbedAboveBase) {
    return 8;
  }
  return 0;
}

function scoreLongBoxBreakout(candles: Candle[]) {
  if (candles.length < 180) {
    return 0;
  }

  const recentHoldWindow = candles.slice(-20);
  const priorWindow = candles.slice(Math.max(0, candles.length - 260), Math.max(0, candles.length - 20));
  if (priorWindow.length < 80 || !recentHoldWindow.length) {
    return 0;
  }

  const boxTop = Math.max(...priorWindow.map((candle) => candle.high));
  const latestClose = candles.at(-1)?.close ?? 0;
  const holdDays = recentHoldWindow.filter((candle) => candle.close > boxTop).length;
  const avgVolume120 = average(candles.slice(Math.max(0, candles.length - 140), Math.max(0, candles.length - 20)).map((candle) => candle.volume)) ?? 0;
  const breakoutVolumeConfirmed = recentHoldWindow.some((candle) => candle.close > boxTop && candle.volume >= avgVolume120 * 1.5);
  const hadBreakoutAttempt = candles.slice(-40).some((candle) => candle.high > boxTop && candle.close <= boxTop);

  if (latestClose > boxTop && holdDays >= 10 && breakoutVolumeConfirmed) {
    return 15;
  }
  if (latestClose > boxTop) {
    return 7;
  }
  if (hadBreakoutAttempt) {
    return -15;
  }
  return 0;
}

function scoreLongOverheadRisk(result: VolumeProfileResult, currentPrice: number) {
  const resistanceCount20 = result.resistanceZones.filter((price) => price <= currentPrice * 1.2).length;
  if (result.supplyRatio >= 2 || resistanceCount20 >= 3) {
    return -20;
  }
  if (result.supplyRatio >= 1.3 || resistanceCount20 >= 2) {
    return -10;
  }
  return 5;
}

function scoreHighVolumeStallRisk(candles: Candle[]) {
  if (candles.length < 120) {
    return 0;
  }

  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const latest = candles.at(-1);
  if (!latest || high <= low) {
    return 0;
  }

  const rangePosition = (latest.close - low) / (high - low);
  if (rangePosition < 0.7) {
    return 0;
  }

  const recent = candles.slice(-30);
  const prior = candles.slice(Math.max(0, candles.length - 90), Math.max(0, candles.length - 30));
  const recentVolume = average(recent.map((candle) => candle.volume)) ?? 0;
  const priorVolume = average(prior.map((candle) => candle.volume)) ?? recentVolume;
  const priceChange30 = percentChange(latest.close, recent[0]?.close) ?? 0;
  const upperWickCount = recent.filter((candle) => {
    const range = candle.high - candle.low;
    return range > 0 && (candle.high - Math.max(candle.open, candle.close)) / range >= 0.35;
  }).length;

  if (recentVolume >= priorVolume * 1.4 && priceChange30 <= 3 && upperWickCount >= 4) {
    return -20;
  }
  if (recentVolume >= priorVolume * 1.2 && priceChange30 <= 6) {
    return -10;
  }
  return 0;
}

function scoreHoldingQuality(params: {
  result: VolumeProfileResult;
  candles: Candle[];
  trendScore?: number;
}) {
  const support = params.result.supportZones[0];
  if (!isFinitePositive(support) || params.candles.length < 40) {
    return 0;
  }

  const recent20 = params.candles.slice(-20);
  const holdDays = recent20.filter((candle) => candle.close > support).length;
  const trendScore = params.trendScore ?? 50;
  if (trendScore < 40 && holdDays < 20) {
    return -10;
  }
  if (holdDays >= 20 && trendScore >= 55 && params.result.supportVolume > params.result.overheadVolume) {
    return 15;
  }
  if (holdDays >= 10) {
    return 7;
  }
  return -10;
}

export function analyzeLongTermVolumeProfile(points: ChartPoint[], crossCheck: LongTermCrossCheckInput = {}): LongTermVolumeProfileAnalysis {
  const candles = toVolumeProfileCandles(points);
  const currentPrice = candles.at(-1)?.close;
  if (!isFinitePositive(currentPrice)) {
    const empty = emptyVolumeProfileResult(0);
    return {
      oneYear: empty,
      twoYear: empty,
      threeYear: empty,
      score: 0,
      accumulationBaseScore: 0,
      longBoxBreakoutScore: 0,
      longOverheadSupplyRisk: 0,
      highVolumeStallRisk: 0,
      holdingQualityBySupply: 0,
      structuralBreakoutReliability: 0,
      advancedVolumeProfile: empty.advancedVolumeProfile,
      summary: "매물대 계산에 필요한 장기 일봉 거래량 데이터가 부족합니다."
    };
  }

  const oneYear = evaluateVolumeProfile(candles, {
    lookbackDays: 240,
    currentPrice,
    rangeRate: 0.2,
    decayFactor: 180,
    distanceMultiplier: 5,
    minReliabilityLookback: 180
  });
  const twoYear = evaluateVolumeProfile(candles, {
    lookbackDays: Math.min(480, candles.length),
    currentPrice,
    rangeRate: 0.2,
    decayFactor: 300,
    distanceMultiplier: 3.5,
    minReliabilityLookback: 240
  });
  const threeYear = evaluateVolumeProfile(candles, {
    lookbackDays: Math.min(720, candles.length),
    currentPrice,
    rangeRate: 0.2,
    decayFactor: 420,
    distanceMultiplier: 2.5,
    minReliabilityLookback: 240
  });
  const representative = threeYear.lookbackDays >= 480 ? threeYear : twoYear.lookbackDays >= 240 ? twoYear : oneYear;
  const representativeCandles = candles.slice(-representative.lookbackDays);
  const accumulationBaseScore = scoreAccumulationBase(representativeCandles);
  const longBoxBreakoutScore = Math.max(scoreLongBoxBreakout(candles.slice(-240)), scoreLongBoxBreakout(candles.slice(-480)));
  const longOverheadSupplyRisk = scoreLongOverheadRisk(representative, currentPrice);
  const highVolumeStallRisk = scoreHighVolumeStallRisk(representativeCandles);
  let holdingQualityBySupply = scoreHoldingQuality({
    result: representative,
    candles: representativeCandles,
    trendScore: crossCheck.trendScore
  });

  if ((crossCheck.trendScore ?? 50) < 45 && holdingQualityBySupply > 0) {
    holdingQualityBySupply = Math.max(0, holdingQualityBySupply - 7);
  }

  const structuralBreakoutReliability =
    longBoxBreakoutScore >= 15 && (crossCheck.trendScore ?? 50) >= 55 && (crossCheck.liquidityScore ?? 50) >= 55
      ? 15
      : longBoxBreakoutScore >= 7 && (crossCheck.trendScore ?? 50) >= 50
        ? 7
        : 0;

  let score =
    accumulationBaseScore +
    longBoxBreakoutScore +
    longOverheadSupplyRisk +
    highVolumeStallRisk +
    holdingQualityBySupply +
    structuralBreakoutReliability;
  if ((crossCheck.financialScore ?? 60) < 45 && score > 0) {
    score -= 6;
  }
  if ((crossCheck.liquidityScore ?? 60) < 45 && score > 0) {
    score -= 4;
  }
  if ((crossCheck.marketCycleScore ?? 50) < 40 && score > 0) {
    score -= 5;
  }
  if ((representative.profileReliability ?? 100) < 60 && score > 0) {
    score = Math.round(score * 0.5);
  }

  const summaryParts: string[] = [];
  if (accumulationBaseScore >= 15) {
    summaryParts.push("장기 바닥권에서 거래량이 누적된 뒤 현재가가 주요 매물대 위로 올라온 구조입니다.");
  } else if (accumulationBaseScore >= 8) {
    summaryParts.push("장기 하단부 거래량 누적 신호가 일부 확인됩니다.");
  }
  if (longBoxBreakoutScore >= 15) {
    summaryParts.push("장기 박스권 상단을 거래량과 함께 돌파한 뒤 안착 중입니다.");
  } else if (longBoxBreakoutScore >= 7) {
    summaryParts.push("장기 박스권 상단을 돌파했으나 안착 기간은 추가 확인이 필요합니다.");
  } else if (longBoxBreakoutScore <= -15) {
    summaryParts.push("장기 박스권 돌파 실패 또는 재진입 가능성이 있습니다.");
  }
  if (longOverheadSupplyRisk <= -20) {
    summaryParts.push("현재가 위 20% 구간에 장기 매물이 두꺼워 중장기 기대수익률은 보수적으로 봐야 합니다.");
  }
  if (highVolumeStallRisk <= -10) {
    summaryParts.push("고점권에서 대량거래가 발생했지만 가격 진전이 제한되어 분산 위험이 있습니다.");
  }
  if (holdingQualityBySupply >= 15) {
    summaryParts.push("장기 매물대 위에서 20거래일 이상 유지되어 보유 품질이 양호합니다.");
  }
  if (structuralBreakoutReliability > 0) {
    summaryParts.push("장기 박스 돌파, 거래량, 추세가 함께 맞아 구조적 돌파 신뢰도가 개선됩니다.");
  }
  if (!summaryParts.length) {
    summaryParts.push(representative.comment);
  }
  if ((representative.profileReliability ?? 100) < 60) {
    summaryParts.push("장기 매물대 신뢰도가 낮아 구조 해석을 보수적으로 제한합니다.");
  }
  if ((crossCheck.trendScore ?? 50) < 45 && score > 0) {
    summaryParts.push("장기 매물대 구조는 우호적이나 추세 점수가 낮아 신뢰도는 제한적입니다.");
  }

  return {
    oneYear,
    twoYear,
    threeYear,
    score: clampScore(score, -30, 40),
    accumulationBaseScore,
    longBoxBreakoutScore,
    longOverheadSupplyRisk,
    highVolumeStallRisk,
    holdingQualityBySupply,
    structuralBreakoutReliability,
    advancedVolumeProfile: representative.advancedVolumeProfile,
    summary: [...new Set(summaryParts)].join(" ")
  };
}
