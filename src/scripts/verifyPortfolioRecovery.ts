import assert from "node:assert/strict";
import {
  isPortfolioAccountBudgetUsable,
  isPortfolioAccountSnapshotFresh,
  isPortfolioQuoteDateFresh
} from "../services/portfolio/portfolioManager.js";
import { buildPortfolioRecoveryPlan } from "../services/portfolio/recovery.js";
import { evaluatePortfolioHolding } from "../services/portfolio/rules.js";
import type { AiAction, PortfolioHolding } from "../services/portfolio/types.js";

function createHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    id: "TEST:manual",
    symbol: "000000",
    name: "리커버리 테스트",
    avgPrice: 10_000,
    currentPrice: 8_000,
    quantity: 100,
    investedAmount: 1_000_000,
    evaluationAmount: 800_000,
    profitRate: -20,
    originalIntent: "LONG_TERM",
    ...overrides
  };
}

function build(action: AiAction, overrides: Partial<PortfolioHolding> = {}, budget = 250_000) {
  return buildPortfolioRecoveryPlan({
    holding: createHolding(overrides),
    aiAction: action,
    currentMode: action === "REDUCE_ON_REBOUND" ? "LONG_TERM_WEAKENED" : "LONG_TERM_VALID",
    executionPlan: {
      invalidPrice: 7_000,
      reboundReduceZone: {
        from: 9_000,
        to: 10_000
      },
      conditions: ["테스트 조건"]
    },
    budget: {
      priceSource: "LIVE_QUOTE",
      maxAdditionalBuyAmount: budget
    }
  });
}

const ready = build("ADD_ALLOWED");
assert.equal(ready.status, "RECOVERY_READY");
assert.ok((ready.suggestedAdditionalBuyAmount ?? 0) > 0);
assert.ok((ready.suggestedAdditionalBuyAmount ?? 0) <= (ready.maxAdditionalBuyAmount ?? 0));
assert.ok(ready.simulation);
assert.ok(ready.simulation.newAvgPrice < ready.breakEvenPrice);
assert.ok(ready.simulation.requiredReboundRateAfterBuy < ready.requiredReboundRate);
assert.equal(ready.simulation.lossAmountAfterBuy, ready.currentLossAmount);
assert.ok(ready.simulation.firstRecoveryTarget);
const stagedRecoveryProceeds =
  (ready.simulation.firstRecoveryTarget.expectedProceeds ?? 0) +
  ready.simulation.finalRecoveryTarget.price *
    (ready.simulation.finalRecoveryTarget.sellQuantity ?? 0);
const stagedRecoveryTargetProceeds =
  ready.simulation.newTotalInvestedAmount *
  (1 + ready.simulation.finalRecoveryTarget.targetProfitRate / 100);
assert.ok(
  Math.abs(stagedRecoveryProceeds - stagedRecoveryTargetProceeds) <=
    (ready.simulation.finalRecoveryTarget.sellQuantity ?? 1)
);

const waiting = build("ADD_WAIT");
assert.equal(waiting.status, "WAIT_SIGNAL");
assert.equal(waiting.suggestedAdditionalBuyAmount, undefined);
assert.equal(waiting.simulation, undefined);

const reduceOnly = build("REDUCE_ON_REBOUND");
assert.equal(reduceOnly.status, "REDUCE_ONLY");
assert.equal(reduceOnly.suggestedAdditionalBuyAmount, undefined);
assert.equal(reduceOnly.simulation, undefined);

const profitable = build("ADD_ALLOWED", {
  currentPrice: 11_000,
  evaluationAmount: 1_100_000,
  profitRate: 10
});
assert.equal(profitable.status, "NOT_ELIGIBLE");

const belowOneShare = build("ADD_ALLOWED", {}, 3_000);
assert.equal(belowOneShare.status, "WAIT_SIGNAL");
assert.ok(belowOneShare.blockReasons.includes("POSITION_LIMIT"));

const deepLoss = build(
  "ADD_WAIT",
  {
    avgPrice: 20_000,
    currentPrice: 8_000,
    investedAmount: 2_000_000,
    evaluationAmount: 800_000,
    profitRate: -60
  },
  250_000
);
assert.equal(deepLoss.status, "WAIT_SIGNAL");
assert.ok(deepLoss.blockReasons.includes("LOSS_TOO_DEEP"));
assert.ok((deepLoss.requiredAdditionalBuyAmountForTarget ?? 0) > (deepLoss.maxAdditionalBuyAmount ?? 0));
assert.equal(deepLoss.simulation, undefined);

const staleQuote = buildPortfolioRecoveryPlan({
  holding: createHolding(),
  aiAction: "ADD_ALLOWED",
  currentMode: "LONG_TERM_VALID",
  executionPlan: {
    invalidPrice: 7_000,
    conditions: []
  },
  budget: {
    priceSource: "STORED_FALLBACK",
    maxAdditionalBuyAmount: 250_000,
    budgetAvailable: true
  }
});
assert.equal(staleQuote.status, "WAIT_SIGNAL");
assert.ok(staleQuote.blockReasons.includes("QUOTE_UNAVAILABLE"));

const missingAccountBudget = buildPortfolioRecoveryPlan({
  holding: createHolding(),
  aiAction: "ADD_ALLOWED",
  currentMode: "LONG_TERM_VALID",
  executionPlan: {
    invalidPrice: 7_000,
    conditions: []
  },
  budget: {
    priceSource: "LIVE_QUOTE",
    budgetAvailable: false
  }
});
assert.equal(missingAccountBudget.status, "WAIT_SIGNAL");
assert.ok(missingAccountBudget.blockReasons.includes("ACCOUNT_BUDGET_UNAVAILABLE"));

const correctedInvestedAmount = build(
  "ADD_ALLOWED",
  {
    investedAmount: 5_000_000
  }
);
assert.equal(correctedInvestedAmount.currentInvestedAmount, 1_000_000);
assert.ok(correctedInvestedAmount.warnings.some((warning) => warning.includes("보정")));

const belowFixedInvalidPrice = build("ADD_ALLOWED", {
  currentPrice: 6_500,
  evaluationAmount: 650_000,
  profitRate: -35
});
assert.equal(belowFixedInvalidPrice.status, "WAIT_SIGNAL");
assert.ok(belowFixedInvalidPrice.blockReasons.includes("BELOW_INVALID_PRICE"));

const longTermPick = {
  key: "TEST",
  name: "리커버리 테스트",
  symbol: "000000",
  anchorDate: "2026-07-01",
  category: "longTerm",
  longTermBucket: "accumulate"
} as const;
const fixedInvalidAtFirstQuote = evaluatePortfolioHolding(createHolding(), {
  longTermPick
}).executionPlan?.invalidPrice;
const fixedInvalidAtLowerQuote = evaluatePortfolioHolding(
  createHolding({
    currentPrice: 7_500,
    evaluationAmount: 750_000,
    profitRate: -25
  }),
  { longTermPick }
).executionPlan?.invalidPrice;
assert.equal(fixedInvalidAtFirstQuote, 7_000);
assert.equal(fixedInvalidAtLowerQuote, fixedInvalidAtFirstQuote);

const ignoredHeuristicStop = evaluatePortfolioHolding(createHolding(), {
  longTermPick,
  swingCase: {
    id: "OLD-CLOSED-CASE",
    status: "closed",
    buyPlan: {
      stopLossPrice: 3_000
    }
  }
}).executionPlan?.invalidPrice;
assert.equal(ignoredHeuristicStop, 7_000);

const directlyLinkedStop = evaluatePortfolioHolding(
  createHolding({
    sourceRecommendationId: "DIRECT-CASE"
  }),
  {
    longTermPick,
    swingCase: {
      id: "DIRECT-CASE",
      status: "closed",
      buyPlan: {
        stopLossPrice: 3_000
      }
    }
  }
).executionPlan?.invalidPrice;
assert.equal(directlyLinkedStop, 7_000);

assert.equal(isPortfolioQuoteDateFresh("2026-07-24", "2026-07-27"), true);
assert.equal(isPortfolioQuoteDateFresh("2026-07-22", "2026-07-27"), false);
assert.equal(
  isPortfolioAccountSnapshotFresh(
    {
      capturedAt: "2026-07-26T00:00:00.000Z",
      source: "manual"
    },
    Date.parse("2026-07-27T00:00:00.000Z")
  ),
  true
);
assert.equal(
  isPortfolioAccountSnapshotFresh(
    {
      capturedAt: "2026-07-20T00:00:00.000Z",
      source: "manual"
    },
    Date.parse("2026-07-27T00:00:00.000Z")
  ),
  false
);
const freshAccount = {
  capturedAt: "2026-07-26T00:00:00.000Z",
  source: "manual"
} as const;
const accountSummaryBase = {
  total: 1,
  totalQuantity: 100,
  totalInvestedAmount: 1_000_000,
  totalEvaluationAmount: 800_000,
  totalProfitAmount: -200_000,
  totalProfitRate: -20,
  buyingPower: 500_000,
  account: freshAccount
};
assert.equal(
  isPortfolioAccountBudgetUsable(
    accountSummaryBase,
    Date.parse("2026-07-27T00:00:00.000Z")
  ),
  false
);
assert.equal(
  isPortfolioAccountBudgetUsable(
    {
      ...accountSummaryBase,
      estimatedTotalAsset: 2_000_000
    },
    Date.parse("2026-07-27T00:00:00.000Z")
  ),
  true
);

console.log("Portfolio recovery verification passed.");
