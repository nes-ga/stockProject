import { readFile } from "node:fs/promises";
import path from "node:path";
import { readServerLongTermPicks, type ServerLongTermPick } from "../serverLongTermPicks.js";
import type { PortfolioHolding, PortfolioLinkedHistory } from "./types.js";

const swingHistoryPath = path.resolve(process.cwd(), "data", "recommendation-history", "swing-history.json");

type SwingHistoryCase = {
  id?: string;
  symbol?: string;
  name?: string;
  status?: string;
  lifecycleStatus?: string;
  openedDate?: string;
  dataDate?: string;
  cycleNo?: number;
  cycleMeta?: {
    cycleNo?: number;
    isRecovery?: boolean;
    recoveryFromCaseId?: string;
  };
  historyOutcome?: {
    outcome?: string;
    category?: string;
  };
  outcome?: string;
  returnPct?: number;
};

export type PortfolioHistoryLinks = {
  swingCase?: SwingHistoryCase;
  longTermPick?: ServerLongTermPick;
  linkedHistory: PortfolioLinkedHistory;
};

async function readRawSwingHistoryCases(): Promise<SwingHistoryCase[]> {
  try {
    const raw = await readFile(swingHistoryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.cases) ? parsed.cases : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

function getCaseDateValue(historyCase: SwingHistoryCase) {
  return historyCase.dataDate ?? historyCase.openedDate ?? "";
}

function pickSwingHistoryCase(holding: PortfolioHolding, cases: SwingHistoryCase[]) {
  const sameSymbol = cases.filter((historyCase) => historyCase.symbol === holding.symbol);
  if (!sameSymbol.length) {
    return undefined;
  }

  if (holding.sourceRecommendationId) {
    const direct = sameSymbol.find((historyCase) => historyCase.id === holding.sourceRecommendationId);
    if (direct) {
      return direct;
    }
  }

  const current = sameSymbol.find((historyCase) => historyCase.lifecycleStatus === "current" || historyCase.status === "active");
  if (current) {
    return current;
  }

  return [...sameSymbol].sort((left, right) => getCaseDateValue(right).localeCompare(getCaseDateValue(left)))[0];
}

function buildSwingLinkedHistory(historyCase: SwingHistoryCase): PortfolioLinkedHistory {
  const cycleNo = historyCase.cycleMeta?.cycleNo ?? historyCase.cycleNo;
  return {
    source: "swing_history",
    caseId: historyCase.id,
    cycleNo,
    outcome: historyCase.historyOutcome?.outcome ?? historyCase.outcome,
    recoveryContext: historyCase.cycleMeta?.isRecovery
      ? `recommendation_cycle_recovery${historyCase.cycleMeta.recoveryFromCaseId ? `:${historyCase.cycleMeta.recoveryFromCaseId}` : ""}`
      : undefined
  };
}

export async function linkPortfolioHistories(holdings: PortfolioHolding[]): Promise<Map<string, PortfolioHistoryLinks>> {
  const [swingCases, longTermPicks] = await Promise.all([
    readRawSwingHistoryCases().catch(() => []),
    readServerLongTermPicks().catch(() => [])
  ]);
  const longTermBySymbol = new Map(longTermPicks.map((item) => [item.symbol, item]));
  const linked = new Map<string, PortfolioHistoryLinks>();

  for (const holding of holdings) {
    const swingCase = pickSwingHistoryCase(holding, swingCases);
    const longTermPick = longTermBySymbol.get(holding.symbol);
    const linkedHistory = swingCase
      ? buildSwingLinkedHistory(swingCase)
      : longTermPick
        ? ({
            source: "long_term_pick",
            caseId: longTermPick.key,
            outcome: longTermPick.longTermBucket
          } satisfies PortfolioLinkedHistory)
        : ({
            source: "none"
          } satisfies PortfolioLinkedHistory);

    linked.set(holding.id, {
      swingCase,
      longTermPick,
      linkedHistory
    });
  }

  return linked;
}
