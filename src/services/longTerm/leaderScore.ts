import type { LongTermLeaderTier, LongTermUniverseSeed } from "../../types.js";
import { clamp } from "./utils.js";

function resolveTierBaseScore(tier: LongTermLeaderTier): number {
  switch (tier) {
    case "core":
      return 84;
    case "primary":
      return 74;
    case "secondary":
      return 64;
    default:
      return 60;
  }
}

export function calculateLeaderScore(params: {
  seed: LongTermUniverseSeed;
  turnoverRank?: number;
  sectorTurnoverRank?: number;
  sectorPeerCount?: number;
  isCurated?: boolean;
}): number {
  if (params.isCurated === false) {
    let score = 38;

    if (params.turnoverRank != null) {
      if (params.turnoverRank <= 20) {
        score += 30;
      } else if (params.turnoverRank <= 60) {
        score += 22;
      } else if (params.turnoverRank <= 120) {
        score += 16;
      } else if (params.turnoverRank <= 240) {
        score += 10;
      } else {
        score += 4;
      }
    } else {
      score += 6;
    }

    if ((params.sectorPeerCount ?? 0) >= 3 && params.sectorTurnoverRank != null) {
      if (params.sectorTurnoverRank === 1) {
        score += 20;
      } else if (params.sectorTurnoverRank <= 3) {
        score += 12;
      } else if (params.sectorTurnoverRank <= 5) {
        score += 6;
      }
    }

    return clamp(Math.round(score), 0, 100);
  }

  const baseScore = resolveTierBaseScore(params.seed.tier);
  const curatedBonus = 8;
  const turnoverBonus =
    params.turnoverRank == null ? 4 : params.turnoverRank <= 3 ? 10 : params.turnoverRank <= 8 ? 6 : 2;

  return clamp(Math.round(baseScore + curatedBonus + turnoverBonus), 0, 100);
}
