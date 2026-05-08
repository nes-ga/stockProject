import assert from "node:assert/strict";
import type { ChartPoint } from "../types.js";
import { analyzeLongTermVolumeProfile, analyzeSwingVolumeProfile, buildVolumeProfile } from "../services/volumeProfile.js";

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function candle(index: number, close: number, volume: number, spread = 0.02): ChartPoint {
  return {
    date: addDays("2024-01-01", index),
    open: close * 0.995,
    high: close * (1 + spread),
    low: close * (1 - spread),
    close,
    volume
  };
}

function buildOverheadSupplyCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 40; index += 1) {
    points.push(candle(index, 96, 300_000, 0.01));
  }
  for (let index = 40; index < 110; index += 1) {
    points.push(candle(index, 102, 2_000_000, 0.006));
  }
  for (let index = 110; index < 120; index += 1) {
    points.push(candle(index, 100, 250_000, 0.006));
  }
  return points;
}

function buildBreakoutAbsorptionCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 115; index += 1) {
    points.push(candle(index, 100, 500_000));
  }
  for (let index = 115; index < 120; index += 1) {
    points.push(candle(index, 106 + (index - 115) * 0.4, index === 116 ? 1_200_000 : 700_000));
  }
  return points;
}

function buildLongAccumulationCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 520; index += 1) {
    const close = index < 330 ? 55 + (index % 8) : index < 480 ? 72 + (index % 5) : 90 + (index - 480) * 0.4;
    const volume = index < 330 ? 1_500_000 : index > 480 ? 2_200_000 : 700_000;
    points.push(candle(index, close, volume, 0.025));
  }
  return points;
}

function buildPullbackSupportCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 90; index += 1) {
    points.push(candle(index, 94 + (index % 3), 1_600_000));
  }
  for (let index = 90; index < 120; index += 1) {
    points.push(candle(index, 102 + (index % 4) * 0.3, 700_000));
  }
  return points;
}

function buildHighVolumeStallCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 520; index += 1) {
    const close = index < 460 ? 70 + index * 0.08 : 112 + (index % 4) * 0.3;
    const volume = index < 460 ? 500_000 : 1_200_000;
    points.push({
      ...candle(index, close, volume, 0.04),
      open: close * 1.01,
      high: close * 1.08
    });
  }
  return points;
}

function buildHighVolatilityThemeCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 120; index += 1) {
    const close = 100 + Math.sin(index / 2) * 9 + (index % 7 === 0 ? 7 : 0);
    points.push(candle(index, close, 1_200_000, 0.12));
  }
  return points;
}

function buildRecentVolumeDecayCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 60; index += 1) {
    points.push(candle(index, 82, 1_000_000, 0.015));
  }
  for (let index = 60; index < 120; index += 1) {
    points.push(candle(index, 118, 1_000_000, 0.015));
  }
  return points;
}

function buildRetestSuccessCase() {
  const points: ChartPoint[] = [];
  const bullish = (index: number, close: number, volume: number): ChartPoint => ({
    date: addDays("2024-01-01", index),
    open: close * 0.99,
    high: close * 1.003,
    low: close * 0.985,
    close,
    volume
  });
  for (let index = 0; index < 108; index += 1) {
    points.push(bullish(index, 100, 900_000));
  }
  points.push(bullish(108, 101, 700_000));
  points.push(bullish(109, 103, 900_000));
  points.push(bullish(110, 106, 1_500_000));
  points.push({ ...bullish(111, 102, 700_000), low: 100.8 });
  points.push(bullish(112, 103, 550_000));
  points.push(bullish(113, 105, 800_000));
  points.push(bullish(114, 108, 1_050_000));
  for (let index = 115; index < 120; index += 1) {
    points.push(bullish(index, 108 + (index - 115) * 0.2, 850_000));
  }
  return points;
}

function buildRetestFailureCase() {
  const points = buildRetestSuccessCase();
  points[113] = { ...candle(113, 98, 1_400_000, 0.025), open: 105, high: 106 };
  points[114] = candle(114, 97, 1_200_000, 0.02);
  for (let index = 115; index < 120; index += 1) {
    points[index] = candle(index, 98 + (index % 2), 900_000, 0.015);
  }
  return points;
}

function buildSplitLikeCase() {
  const points: ChartPoint[] = [];
  for (let index = 0; index < 95; index += 1) {
    points.push(candle(index, 100, 500_000, 0.015));
  }
  points.push(candle(95, 62, 1_400_000, 0.015));
  for (let index = 96; index < 120; index += 1) {
    points.push(candle(index, 63 + (index % 3), 700_000, 0.015));
  }
  return points;
}

const overhead = analyzeSwingVolumeProfile(buildOverheadSupplyCase(), { themeScore: 70, trendScore: 45 });
assert.ok(overhead.chaseRiskBySupply > 0, "overhead supply should raise chase risk");

const breakout = analyzeSwingVolumeProfile(buildBreakoutAbsorptionCase(), { volumeScore: 85, trendScore: 65 });
assert.ok(breakout.breakoutReliabilityBySupply > 0, "breakout absorption should raise reliability");

const pullbackSupport = analyzeSwingVolumeProfile(buildPullbackSupportCase(), { pullbackScore: 75, trendScore: 65 });
assert.ok(pullbackSupport.pullbackSupportQuality > 0, "support below price should raise pullback quality");

const accumulation = analyzeLongTermVolumeProfile(buildLongAccumulationCase(), { trendScore: 65, financialScore: 65 });
assert.ok(accumulation.accumulationBaseScore > 0, "long accumulation should score");
assert.ok(accumulation.longBoxBreakoutScore > 0, "long box breakout should score after sustained hold");

const stall = analyzeLongTermVolumeProfile(buildHighVolumeStallCase(), { trendScore: 60, financialScore: 60 });
assert.ok(stall.highVolumeStallRisk < 0, "high-volume stall should be penalized");

const weakCrossCheck = analyzeSwingVolumeProfile(buildBreakoutAbsorptionCase(), { volumeScore: 20, trendScore: 25, themeScore: 20 });
assert.ok(
  weakCrossCheck.score < breakout.score,
  "weak trend/volume/theme cross-check should keep volume-profile support from over-upgrading the signal"
);

const highVolatility = analyzeSwingVolumeProfile(buildHighVolatilityThemeCase(), { trendScore: 55, volumeScore: 55 });
assert.ok(highVolatility.baseTerm.atr14 != null && highVolatility.baseTerm.atr14 > 0, "ATR(14) should be calculated");
assert.ok(
  highVolatility.baseTerm.dynamicBinSize != null &&
    highVolatility.baseTerm.dynamicBinSize >= (highVolatility.baseTerm.atr14 ?? 0) * 0.25 * 0.35,
  "dynamic bin size should react to high volatility"
);

const recentDecay = analyzeSwingVolumeProfile(buildRecentVolumeDecayCase(), { trendScore: 55, volumeScore: 55 });
assert.ok((recentDecay.baseTerm.pocPrice ?? 0) > 100, "time decay should make recent volume zones more influential");

const bodyWeightedProfile = buildVolumeProfile(
  [{ date: "2024-01-01", open: 100, high: 120, low: 90, close: 118, volume: 1_000 }],
  10,
  { weightedBodyDistribution: true }
);
assert.ok(
  (bodyWeightedProfile.get(110) ?? 0) > (bodyWeightedProfile.get(90) ?? 0),
  "large bullish body should receive more allocated volume than lower wick"
);

assert.ok(
  (overhead.shortTerm.upsideToResistance ?? 1) < 0.05 || overhead.chaseRiskBySupply >= 18,
  "nearby resistance should be reflected as stronger chase risk"
);

const retestSuccess = analyzeSwingVolumeProfile(buildRetestSuccessCase(), { trendScore: 65, volumeScore: 85 });
assert.ok((retestSuccess.baseTerm.retestSuccessScore ?? 0) > 0, "successful retest should score positively");

const retestFailure = analyzeSwingVolumeProfile(buildRetestFailureCase(), { trendScore: 55, volumeScore: 70 });
assert.ok((retestFailure.baseTerm.retestFailureRisk ?? 0) < 0, "failed retest/reentry should be penalized");

assert.ok(
  (overhead.shortTerm.rewardRiskRatio ?? 2) < 1 || (overhead.shortTerm.upsideToResistance ?? 1) < 0.05,
  "limited upside to next resistance should be detected"
);

const structuralBreakout = analyzeLongTermVolumeProfile(buildLongAccumulationCase(), { trendScore: 70, financialScore: 70, liquidityScore: 70 });
assert.ok((structuralBreakout.structuralBreakoutReliability ?? 0) > 0, "long box breakout with trend and liquidity should improve structural reliability");

const splitLike = analyzeSwingVolumeProfile(buildSplitLikeCase(), { trendScore: 45, volumeScore: 45 });
assert.ok((splitLike.baseTerm.profileReliability ?? 100) < 100, "split-like data should lower profile reliability");
assert.ok(
  (splitLike.baseTerm.reliabilityWarnings ?? []).includes("possible_split_or_capital_action"),
  "split-like data should emit a reliability warning"
);

console.log(
  JSON.stringify(
    {
      overhead: {
        score: overhead.score,
        chaseRiskBySupply: overhead.chaseRiskBySupply,
        supplyRatio: overhead.shortTerm.supplyRatio
      },
      breakout: {
        score: breakout.score,
        breakoutReliabilityBySupply: breakout.breakoutReliabilityBySupply,
        breakoutScore: breakout.baseTerm.breakoutScore
      },
      pullbackSupport: {
        score: pullbackSupport.score,
        pullbackSupportQuality: pullbackSupport.pullbackSupportQuality
      },
      accumulation: {
        score: accumulation.score,
        accumulationBaseScore: accumulation.accumulationBaseScore,
        longBoxBreakoutScore: accumulation.longBoxBreakoutScore
      },
      stall: {
        score: stall.score,
        highVolumeStallRisk: stall.highVolumeStallRisk
      },
      weakCrossCheck: {
        score: weakCrossCheck.score
      },
      advanced: {
        dynamicBinSize: highVolatility.baseTerm.dynamicBinSize,
        atr14: highVolatility.baseTerm.atr14,
        recentDecayPoc: recentDecay.baseTerm.pocPrice,
        retestSuccessScore: retestSuccess.baseTerm.retestSuccessScore,
        retestFailureRisk: retestFailure.baseTerm.retestFailureRisk,
        rewardRiskRatio: overhead.shortTerm.rewardRiskRatio,
        structuralBreakoutReliability: structuralBreakout.structuralBreakoutReliability,
        profileReliability: splitLike.baseTerm.profileReliability,
        reliabilityWarnings: splitLike.baseTerm.reliabilityWarnings
      }
    },
    null,
    2
  )
);
