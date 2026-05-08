import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeSmartMoneyPatterns } from "../services/stockAnalysis.js";
import { fetchLongTermChart } from "../services/longTerm/marketData.js";
import { analyzeLongTermVolumeProfile } from "../services/volumeProfile.js";
import { readServerSwingPickPayload } from "../services/serverSwingPicks.js";

type StoredPick = {
  name?: string;
  symbol: string;
};

const limit = Number(process.env.VP_IMPACT_LIMIT ?? 8);

async function readLongTermPicks(): Promise<StoredPick[]> {
  const raw = await readFile(path.resolve(process.cwd(), "data", "server-long-term-picks.json"), "utf8");
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : [])
    .filter((item): item is StoredPick => item && typeof item.symbol === "string")
    .slice(0, limit);
}

async function readSwingPicks(): Promise<StoredPick[]> {
  const [defaultPayload, smallcapPayload] = await Promise.all([
    readServerSwingPickPayload("default"),
    readServerSwingPickPayload("smallcap")
  ]);
  const merged = new Map<string, StoredPick>();
  for (const item of [...defaultPayload.items, ...smallcapPayload.items]) {
    if (!merged.has(item.symbol)) {
      merged.set(item.symbol, {
        symbol: item.symbol,
        name: item.name
      });
    }
  }
  return [...merged.values()].slice(0, limit);
}

async function checkSwingImpact(items: StoredPick[]) {
  const analyses = await analyzeSmartMoneyPatterns(
    items.map((item) => ({
      symbol: item.symbol,
      name: item.name
    })),
    {
      lookbackTradingDays: 45
    }
  );

  return analyses.map((analysis) => {
    const profile = analysis.pattern.swingVolumeProfile;
    return {
      symbol: analysis.symbol,
      name: analysis.name,
      stage: analysis.pattern.stage,
      status: analysis.pattern.status,
      patternScore: analysis.pattern.patternScore,
      finalRankScore: analysis.pattern.finalRankScore,
      volumeProfileScore: profile?.score ?? 0,
      chaseRiskBySupply: profile?.chaseRiskBySupply ?? 0,
      breakoutReliabilityBySupply: profile?.breakoutReliabilityBySupply ?? 0,
      pullbackSupportQuality: profile?.pullbackSupportQuality ?? 0,
      summary: profile?.summary
    };
  });
}

async function checkLongTermImpact(items: StoredPick[]) {
  const results = [];
  for (const item of items) {
    const points = await fetchLongTermChart(item.symbol, 760);
    const profile = analyzeLongTermVolumeProfile(points, {
      trendScore: 60,
      financialScore: 60,
      liquidityScore: 60
    });
    results.push({
      symbol: item.symbol,
      name: item.name,
      volumeProfileScore: profile.score,
      accumulationBaseScore: profile.accumulationBaseScore,
      longBoxBreakoutScore: profile.longBoxBreakoutScore,
      longOverheadSupplyRisk: profile.longOverheadSupplyRisk,
      highVolumeStallRisk: profile.highVolumeStallRisk,
      holdingQualityBySupply: profile.holdingQualityBySupply,
      representativeSupplyRatio:
        profile.threeYear.lookbackDays >= 480
          ? profile.threeYear.supplyRatio
          : profile.twoYear.lookbackDays >= 240
            ? profile.twoYear.supplyRatio
            : profile.oneYear.supplyRatio,
      summary: profile.summary
    });
  }
  return results;
}

const [swingItems, longTermItems] = await Promise.all([readSwingPicks(), readLongTermPicks()]);
const [swing, longTerm] = await Promise.all([checkSwingImpact(swingItems), checkLongTermImpact(longTermItems)]);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      limitPerGroup: limit,
      swing,
      longTerm
    },
    null,
    2
  )
);
