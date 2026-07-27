export type OriginalIntent = "SWING" | "LONG_TERM" | "UNKNOWN";

export type SuggestedIntent = "SWING" | "LONG_TERM" | "RECOVERY" | "EXIT_MANAGEMENT" | "NO_EDGE" | "UNKNOWN";

export type CurrentMode =
  | "SWING_VALID"
  | "SWING_DAMAGED"
  | "SWING_BROKEN"
  | "LONG_TERM_VALID"
  | "LONG_TERM_WEAKENED"
  | "HOLDING_RECOVERY_CANDIDATE"
  | "DEAD_MONEY"
  | "UNKNOWN";

export type AiAction =
  | "HOLD"
  | "WATCH"
  | "ADD_WAIT"
  | "ADD_ALLOWED"
  | "ROTATION_BUY"
  | "REDUCE_ON_REBOUND"
  | "CUT_LOSS"
  | "NO_ACTION";

export type PortfolioHolding = {
  id: string;
  symbol: string;
  name: string;
  avgPrice: number;
  currentPrice: number;
  quantity: number;
  investedAmount?: number;
  evaluationAmount?: number;
  profitRate?: number;
  originalIntent: OriginalIntent;
  openedDate?: string;
  sourceRecommendationId?: string;
  memo?: string;
};

export type PortfolioAccountSnapshot = {
  brokerName?: string;
  accountLabel?: string;
  cashBalance?: number;
  buyingPower?: number;
  totalInvestedAmount?: number;
  totalEvaluationAmount?: number;
  totalProfitAmount?: number;
  totalProfitRate?: number;
  capturedAt: string;
  source: "screenshot" | "manual";
};

export type PortfolioQuoteItem = {
  id: string;
  symbol: string;
  name: string;
  avgPrice: number;
  currentPrice: number;
  previousClose?: number;
  changeAmount?: number;
  changePercent?: number;
  quantity: number;
  investedAmount: number;
  evaluationAmount: number;
  profitAmount: number;
  profitRate: number;
  stockWeightPercent: number;
  assetWeightPercent?: number;
  latestDate?: string;
  error?: string;
};

export type PortfolioAccountSummary = {
  total: number;
  totalQuantity: number;
  totalInvestedAmount: number;
  totalEvaluationAmount: number;
  totalProfitAmount: number;
  totalProfitRate: number;
  cashBalance?: number;
  buyingPower?: number;
  estimatedTotalAsset?: number;
  stockWeightPercent?: number;
  cashWeightPercent?: number;
  account?: PortfolioAccountSnapshot;
};

export type PortfolioLinkedHistory = {
  source: "swing_history" | "long_term_pick" | "manual" | "none";
  caseId?: string;
  cycleNo?: number;
  outcome?: string;
  recoveryContext?: string;
};

export type PortfolioExecutionPlan = {
  watchPrice?: number;
  watchPriceZone?: {
    from?: number;
    to?: number;
  };
  addPriceZone?: {
    from?: number;
    to?: number;
  };
  reboundReduceZone?: {
    from?: number;
    to?: number;
  };
  invalidPrice?: number;
  conditions: string[];
  summary?: string;
};

export type RecoveryPlanStatus = "NOT_ELIGIBLE" | "WAIT_SIGNAL" | "RECOVERY_READY" | "REDUCE_ONLY";

export type RecoveryPlanBlockReason =
  | "INVALID_HOLDING"
  | "QUOTE_UNAVAILABLE"
  | "ACCOUNT_BUDGET_UNAVAILABLE"
  | "ACTION_NOT_ALLOWED"
  | "BELOW_INVALID_PRICE"
  | "POSITION_LIMIT"
  | "RISK_LIMIT"
  | "LOSS_TOO_DEEP"
  | "AMOUNT_BELOW_ONE_SHARE";

export type PortfolioRecoveryTarget = {
  price: number;
  sellQuantity?: number;
  expectedProceeds?: number;
  label: string;
};

export type PortfolioRecoverySimulation = {
  buyPrice: number;
  requestedAdditionalBuyAmount: number;
  additionalBuyQuantity: number;
  actualAdditionalBuyAmount: number;
  newQuantity: number;
  newTotalInvestedAmount: number;
  newAvgPrice: number;
  lossAmountAfterBuy: number;
  requiredReboundRateAfterBuy: number;
  reboundRateImprovement: number;
  avgPriceReductionRate: number;
  firstRecoveryTarget?: PortfolioRecoveryTarget;
  finalRecoveryTarget: PortfolioRecoveryTarget & {
    targetProfitRate: number;
    expectedProfitAmount: number;
  };
};

export type PortfolioRecoveryPlan = {
  status: RecoveryPlanStatus;
  priceSource: "LIVE_QUOTE" | "STORED_FALLBACK";
  calculatedAtPrice: number;
  currentQuantity: number;
  currentInvestedAmount: number;
  currentEvaluationAmount: number;
  currentProfitAmount: number;
  currentLossAmount: number;
  breakEvenPrice: number;
  requiredReboundRate: number;
  targetRequiredReboundRate?: number;
  requiredAdditionalBuyAmountForTarget?: number;
  suggestedAdditionalBuyAmount?: number;
  maxAdditionalBuyAmount?: number;
  simulation?: PortfolioRecoverySimulation;
  reduceTarget?: {
    from?: number;
    to?: number;
  };
  invalidPrice?: number;
  blockReasons: RecoveryPlanBlockReason[];
  warnings: string[];
  summary: string;
  conditions: string[];
};

export type PortfolioAdvice = {
  symbol: string;
  name: string;
  originalIntent: OriginalIntent;
  suggestedIntent: SuggestedIntent;
  currentMode: CurrentMode;
  aiAction: AiAction;
  priority: number;
  priorityLabel: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  summary: string;
  warning?: string;
  reasons: string[];
  risks: string[];
  executionPlan?: PortfolioExecutionPlan;
  recoveryPlan?: PortfolioRecoveryPlan;
  linkedHistory?: PortfolioLinkedHistory;
  questions?: string[];
  holding: PortfolioHolding;
};

export type PortfolioDataSourceMode = "repository-development" | "private-local";

export type PortfolioDataSourceInfo = {
  mode: PortfolioDataSourceMode;
  label: string;
  displayPath: string;
  versionControlled: boolean;
  developmentOnly: boolean;
  readWritePolicy: string;
};

export type PortfolioAdviceResponse = {
  asOfDate: string;
  dataSource: PortfolioDataSourceInfo;
  summary: {
    total: number;
    highPriority: number;
    addAllowed: number;
    addWait: number;
    rotationBuy: number;
    reduceOnRebound: number;
    deadMoney: number;
    suggestedRecoveryBudget: number;
    maxRecoveryBudget: number;
    account: PortfolioAccountSummary;
  };
  items: PortfolioAdvice[];
};

export type PortfolioQuotesResponse = {
  fetchedAt: string;
  summary: PortfolioAccountSummary;
  items: PortfolioQuoteItem[];
  advice: PortfolioAdviceResponse;
};

export type PortfolioScreenshotDraftHolding = {
  symbol?: string;
  name: string;
  avgPrice?: number;
  currentPrice?: number;
  quantity?: number;
  investedAmount?: number;
  evaluationAmount?: number;
  profitRate?: number;
  originalIntent?: OriginalIntent;
  memo?: string;
  confidence?: number;
  sourceRowText?: string;
};

export type PortfolioScreenshotParseResult = {
  brokerName?: string;
  accountLabel?: string;
  cashBalance?: number;
  totalInvestedAmount?: number;
  totalEvaluationAmount?: number;
  totalProfitRate?: number;
  draftHoldings: PortfolioScreenshotDraftHolding[];
  warnings: string[];
  rawText?: string;
};
