import type { LongTermScanFilters, LongTermScanResult } from "../types.js";
import { scanLongTermUniverse } from "./longTermEngine.js";

// Dedicated dividend-engine entry point.
// It currently reuses the long-term universe scan as a bootstrap source so the
// category can be branched cleanly now and swapped to dividend-specific rules later.
export async function scanDividendUniverse(options?: {
  symbols?: string[];
  filters?: Partial<LongTermScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<LongTermScanResult> {
  return scanLongTermUniverse(options);
}
