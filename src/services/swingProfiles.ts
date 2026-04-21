import type { SmartMoneyPatternFilters } from "../types.js";

export type SwingEngineProfile = "default" | "smallcap";

export function resolveSwingEngineProfile(profile?: string): SwingEngineProfile {
  return profile === "smallcap" ? "smallcap" : "default";
}

export function getSwingProfileFilterOverrides(profile: SwingEngineProfile): Partial<SmartMoneyPatternFilters> {
  if (profile !== "smallcap") {
    return {};
  }

  return {
    lookbackWindows: [20, 30, 45, 60, 75],
    minLeadInVolumeRatio: 2.5,
    minLeadInVolumeShares: 500_000,
    minSetupSurgeAdvancePercent: 10
  };
}
