export type StockAnalysis = {
  symbol: string;
  resolvedSymbol: string;
  currency?: string;
  exchangeName?: string;
  shortName?: string;
  price: number;
  previousClose?: number;
  changePercent1d?: number;
  changePercent20d?: number;
  sma5?: number;
  sma20?: number;
  rsi14?: number;
  trend: "bullish" | "bearish" | "neutral";
  summary: string;
};

export type RecommendationRequest = {
  name?: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  category?: "longTerm" | "swing";
};

export type RealtimeStockRequest = {
  key?: string;
  name?: string;
  symbol: string;
  anchorDate?: string;
  category?: "longTerm" | "swing";
};

export type RealtimeStockSnapshot = {
  key?: string;
  name?: string;
  symbol: string;
  resolvedSymbol: string;
  category?: "longTerm" | "swing";
  latestClose?: number;
  previousClose?: number;
  changeAmount?: number;
  changePercent?: number;
  latestDate?: string;
  error?: string;
};

export type RealtimeStockDetail = RealtimeStockSnapshot & {
  chartWindow: {
    startDate: string;
    endDate: string;
    points: ChartPoint[];
  };
  fetchedAt: string;
};

export type RecommendationPatternFilters = {
  lookbackTradingDays: number;
  minPriceChangePercent: number;
  minVolumeRatio: number;
  minSignalScore: number;
  breakoutWindowDays: number;
  requireBreakout: boolean;
  closeNearHighRatio: number;
};

export type RecommendationPatternMatch = {
  matched: boolean;
  windowStartDate?: string;
  windowEndDate?: string;
  signalDate?: string;
  signalScore: number;
  signal: KoreanMoverSignal;
  sessionsBeforeAnchor?: number;
  close?: number;
  previousClose?: number;
  priceChangePercent?: number;
  volume?: number;
  avgVolume20?: number;
  volumeRatio20d?: number;
  breakout10d: boolean;
  breakout20d: boolean;
  closedNearHigh: boolean;
  reasons: string[];
  summary: string;
};

export type RecommendationPatternAnalysis = {
  name?: string;
  symbol: string;
  resolvedSymbol: string;
  anchorDate: string;
  tradingAnchorDate: string;
  latestMentionDate?: string;
  note?: string;
  pattern: RecommendationPatternMatch;
};

export type SmartMoneyPatternFilters = {
  lookbackTradingDays: number;
  lookbackWindows: number[];
  breakoutLookbackDays: number;
  minLeadInPriceChangePercent: number;
  minLeadInVolumeRatio: number;
  minTurnoverValue: number;
  minBreakoutTurnoverValue: number;
  minBreakoutPriceChangePercent: number;
  minBreakoutVolumeRatio: number;
  minPullbackSessions: number;
  maxPullbackSessions: number;
  minSetupPullbackSessions: number;
  minSetupDownSessions: number;
  minTimeCorrectionSessions: number;
  minPullbackDrawdownPercent: number;
  maxPullbackDrawdownPercent: number;
  maxPullbackRangePercent: number;
  maxSetupPullbackDrawdownPercent: number;
  maxSetupPullbackRangePercent: number;
  maxTimeCorrectionDrawdownPercent: number;
  maxTimeCorrectionRangePercent: number;
  maxTimeCorrectionCloseRangePercent: number;
  minTimeCorrectionTightClosePercent: number;
  maxVolatileDigestionDrawdownPercent: number;
  maxVolatileDigestionRangePercent: number;
  maxVolatileDigestionAvgVolumeRatio: number;
  minVolatileDigestionReferenceCloseVsLeadInPercent: number;
  minVolatileDigestionBaseAdvancePercent: number;
  volatileDigestionSetupScoreBoost: number;
  maxPullbackAvgVolumeRatio: number;
  minPatternScore: number;
  minSetupPatternScore: number;
  minBreakoutPatternScore: number;
  minSetupSurgeAdvancePercent: number;
  minSetupContinuationSessions: number;
  minReferenceCloseVsBasePercent: number;
  maxSetupCloseVsPeakPercent: number;
  minReferenceCloseVsLeadInPercent: number;
  closeNearHighRatio: number;
  breakoutHoldTolerancePercent: number;
  maxBreakoutFailurePercent: number;
  maxBreakoutExtensionPercent: number;
  maxSetupDistanceBelowBreakoutLevelPercent: number;
  minPullbackBuyDrawdownPercent: number;
  minPullbackBuyDistanceBelowBreakoutPercent: number;
  minTightPullbackBuyLeadInPriceChangePercent: number;
  pullbackBuyStartPercentFromPeak: number;
  firstBuySma20ProximityPercent: number;
  stopLossLookbackSessions: number;
  tightPullbackBuyZoneLowRetracementRatio: number;
  tightPullbackBuyZoneHighRetracementRatio: number;
  timeCorrectionBuyZoneLowRetracementRatio: number;
  timeCorrectionBuyZoneHighRetracementRatio: number;
  volatileDigestionBuyZoneLowRetracementRatio: number;
  volatileDigestionBuyZoneHighRetracementRatio: number;
  minActionableValidityScore: number;
  minExecutionReadinessScore: number;
  regimeScoreWeight: number;
  minRegimeScoreForActionable: number;
  blockActionableOnRiskOff: boolean;
  recentSignalSessions: number;
  debugTopCandidateLimit: number;
};

export type SmartMoneyPullbackType = "price_pullback" | "time_correction";

export type SmartMoneySetupType = "tight_price_pullback" | "time_correction" | "volatile_power_digestion";

export type SmartMoneyEntryStrategy = "pullback_buy" | "breakout_ready" | "breakout_confirmed" | "no_chase";

export type SmartMoneyStopLossReferenceType = "session_low" | "close_fallback";

export type SmartMoneyBuyPlan = {
  firstBuyPrice: number;
  secondBuyPrice: number;
  thirdBuyPrice: number;
  stopLossPrice: number;
};

export type SmartMoneyWorkflowStatus =
  | "none"
  | "pivot_formed"
  | "pullback_early"
  | "pullback_deep"
  | "pullback_ready"
  | "buy_ready"
  | "breakout_extended"
  | "breakout_ready"
  | "breakout_confirmed"
  | "broken";

export type SmartMoneyMarketContext = {
  asOfDate?: string;
  marketTrend?: "bullish" | "neutral" | "bearish";
  marketBreadth?: {
    score?: number;
    advanceDeclineRatio?: number;
    advancingPercent?: number;
  };
  momentumCondition?: "strong" | "neutral" | "weak";
  leaderPersistenceScore?: number;
  regimeScore?: number;
  marketContextScore?: number;
  trendScore?: number;
  riskScore?: number;
  sectorStrengthScore?: number;
  riskOff?: boolean;
  benchmark?: {
    symbol?: string;
    trend?: "bullish" | "neutral" | "bearish";
    changePercent20d?: number;
    aboveSma20?: boolean;
    aboveSma50?: boolean;
  };
  sector?: {
    name?: string;
    strengthScore?: number;
    relativeStrengthPercent?: number;
  };
  notes?: string[];
};

export type SmartMoneyAppliedMarketContext = SmartMoneyMarketContext & {
  resolvedTrend?: "bullish" | "neutral" | "bearish";
  breadthScore?: number;
  momentumScore?: number;
  regimeScore: number;
  marketContextScore: number;
  marketScoreAdjustment: number;
  entryPriceAdjustmentPercent?: number;
  setupThresholdAdjustment: number;
  breakoutThresholdAdjustment: number;
  actionableAllowed: boolean;
  applied: boolean;
  notes: string[];
};

export type SmartMoneyConditionCheck = {
  key: string;
  label: string;
  passed: boolean;
  actual?: number | string | boolean;
  threshold?: number | string;
  comparator?: ">=" | "<=" | "range" | "equals";
  details: string;
};

export type SmartMoneyRiskFactor = {
  code: string;
  label: string;
  severity: "low" | "medium" | "high";
  scoreImpact: number;
  description: string;
  metrics?: Record<string, number | string | boolean | undefined>;
};

export type SmartMoneyDebugInfo = {
  surgePct?: number;
  surgeDurationDays?: number;
  surgeVolumeRatio?: number;
  peakPrice?: number;
  basePrice?: number;
  breakoutLevel?: number;
  pullbackDays: number;
  pullbackDepthPct?: number;
  pullbackRangePct?: number;
  closeRetentionPct?: number;
  volumeDryingRatio?: number;
  breakoutStatus: "none" | "watch" | "ready" | "confirmed" | "failed";
  supportStatus: "holding" | "testing" | "broken";
  marketScoreAdjustment?: number;
  dangerPenalty?: number;
  conditions: SmartMoneyConditionCheck[];
  summary: string[];
};

export type SmartMoneyBacktestResult = {
  signalDate: string;
  signalClose: number;
  availableSessions: number;
  evaluationWindows: number[];
  forwardReturn5?: number;
  forwardReturn10?: number;
  forwardReturn20?: number;
  maxRunupPct?: number;
  maxDrawdownPct?: number;
  breakoutSuccess?: boolean;
  stopLossHit?: boolean;
  breakoutReferencePrice?: number;
  stopLossReferencePrice?: number;
};

export type SmartMoneyTradePlan = {
  strategy: SmartMoneyEntryStrategy | "setup_watch";
  idealBuyZone?: {
    low: number;
    high: number;
  };
  breakoutPrice?: number;
  stopLoss?: number;
  invalidationPrice?: number;
  targetPrice?: number;
  riskRewardRatio?: number;
  notes: string[];
};

export type SmartMoneyRejectReason = {
  stage: "setup" | "breakout";
  lookbackWindowDays: number;
  leadInDate?: string;
  candidateDate?: string;
  reason: string;
};

export type SmartMoneyCandidateSummary = {
  stage: "setup" | "breakout";
  status: SmartMoneyWorkflowStatus;
  entryStrategy?: SmartMoneyEntryStrategy;
  buyPlan?: SmartMoneyBuyPlan;
  referenceSma20?: number;
  stopLossReferenceDate?: string;
  stopLossReferenceType?: SmartMoneyStopLossReferenceType;
  lookbackWindowDays: number;
  matched: boolean;
  actionable: boolean;
  selected?: boolean;
  pullbackType?: SmartMoneyPullbackType;
  setupType?: SmartMoneySetupType;
  leadInDate?: string;
  surgePeakDate?: string;
  breakoutDate?: string;
  breakoutLevel?: number;
  setupScore: number;
  breakoutScore: number;
  regimeAdjustedScore: number;
  finalRankScore: number;
  regimeScore: number;
  marketContextScore: number;
  volumeQualityScore: number;
  breakoutStrengthScore: number;
  breakoutFailureRiskScore: number;
  dangerScore: number;
  freshnessScore: number;
  validityScore: number;
  executionReadinessScore: number;
  reasons: string[];
  rejectReasons: string[];
};

export type SmartMoneyDebugMeta = {
  evaluatedLookbackWindows: number[];
  evaluatedCandidateCount: number;
  rejectedCandidateCount: number;
  marketContextApplied: boolean;
  selectionPolicy: string;
};

export type SmartMoneyPatternRequest = Pick<RecommendationRequest, "symbol" | "name" | "note"> & {
  referenceDate?: string;
  marketContext?: SmartMoneyMarketContext;
  debug?: boolean;
};

export type SmartMoneyPatternMatch = {
  matched: boolean;
  actionable: boolean;
  stage: "none" | "setup" | "breakout";
  status: SmartMoneyWorkflowStatus;
  entryStrategy?: SmartMoneyEntryStrategy;
  buyPlan?: SmartMoneyBuyPlan;
  referenceSma20?: number;
  stopLossReferenceDate?: string;
  stopLossReferenceType?: SmartMoneyStopLossReferenceType;
  signal: KoreanMoverSignal;
  patternScore: number;
  referenceDate: string;
  windowStartDate?: string;
  windowEndDate?: string;
  leadInDate?: string;
  surgePeakDate?: string;
  surgeContinuationSessions?: number;
  sessionsSinceLeadIn?: number;
  sessionsSincePeak?: number;
  leadInPriceChangePercent?: number;
  pullbackStartDate?: string;
  pullbackEndDate?: string;
  breakoutDate?: string;
  basePrice?: number;
  surgeAdvancePercent?: number;
  surgeDurationDays?: number;
  sessionsSinceBreakout?: number;
  leadInClose?: number;
  leadInHigh?: number;
  leadInVolume?: number;
  leadInVolumeRatio20d?: number;
  surgePeakClose?: number;
  surgePeakHigh?: number;
  pullbackVolumeRatioToLeadIn?: number;
  pullbackRangePercent?: number;
  breakoutClose?: number;
  breakoutPriceChangePercent?: number;
  breakoutVolume?: number;
  breakoutVolumeRatio20d?: number;
  breakoutCloseVsLeadInPercent?: number;
  referenceClose?: number;
  referenceCloseVsBasePercent?: number;
  referenceCloseVsBreakoutLevelPercent?: number;
  referenceCloseVsPeakPercent?: number;
  referenceCloseVsLeadInPercent?: number;
  referenceCloseVsLeadInHighPercent?: number;
  pullbackSessions: number;
  pullbackMaxDrawdownPercent?: number;
  breakout20d: boolean;
  closedNearHigh: boolean;
  pullbackType?: SmartMoneyPullbackType;
  setupType?: SmartMoneySetupType;
  breakoutLevel?: number;
  entryZoneLow?: number;
  entryZoneHigh?: number;
  invalidationPrice?: number;
  leadInTurnoverValue?: number;
  breakoutTurnoverValue?: number;
  volumeQualityScore?: number;
  breakoutStrengthScore?: number;
  breakoutFailureRiskScore?: number;
  freshnessScore?: number;
  validityScore?: number;
  executionReadinessScore?: number;
  setupScore?: number;
  breakoutScore?: number;
  regimeScore?: number;
  marketContextScore?: number;
  regimeAdjustedScore?: number;
  finalRankScore?: number;
  dangerScore: number;
  riskFactors: SmartMoneyRiskFactor[];
  debugInfo: SmartMoneyDebugInfo;
  rejectionReasons: string[];
  marketContext?: SmartMoneyAppliedMarketContext;
  backtestResult?: SmartMoneyBacktestResult;
  tradePlan?: SmartMoneyTradePlan;
  lookbackWindowDays?: number;
  reasons: string[];
  summary: string;
  topCandidates?: SmartMoneyCandidateSummary[];
  rejectReasons?: SmartMoneyRejectReason[];
  debugMeta?: SmartMoneyDebugMeta;
};

export type SmartMoneyPatternAnalysis = {
  name?: string;
  symbol: string;
  resolvedSymbol: string;
  referenceDate?: string;
  tradingReferenceDate: string;
  note?: string;
  pattern: SmartMoneyPatternMatch;
};

export type SmartMoneyWatchItem = {
  symbol: string;
  name?: string;
  note?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastScannedAt?: string;
  lastMatchedBreakoutDate?: string;
};

export type ChartPoint = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
};

export type RecommendationAnalysis = {
  name?: string;
  symbol: string;
  resolvedSymbol: string;
  category?: "longTerm" | "swing";
  anchorDate: string;
  tradingAnchorDate: string;
  latestMentionDate?: string;
  note?: string;
  currency?: string;
  exchangeName?: string;
  shortName?: string;
  anchorClose: number;
  latestClose: number;
  latestDate: string;
  returnSinceAnchor: number;
  maxGainPercent: number;
  maxDrawdownPercent: number;
  highestClose: {
    date: string;
    close: number;
  };
  lowestClose: {
    date: string;
    close: number;
  };
  anchorVolume?: number;
  avgVolume20Before?: number;
  avgVolume20After?: number;
  avgVolume20Latest?: number;
  anchorVolumeVs20dBefore?: number;
  latestVolume?: number;
  latestVolumeVs20d?: number;
  chartWindow: {
    startDate: string;
    endDate: string;
    points: ChartPoint[];
  };
  fundamentals?: FundamentalsSummary;
  longTermReview?: LongTermReviewAnalysis;
};

export type KoreanMoverMarket = "KOSPI" | "KOSDAQ";

export type KoreanMoverSignal = "watch" | "strong" | "explosive";

export type KoreanMoverDirection = "rise" | "fall";

export type KoreanMoverAnalysis = {
  market: KoreanMoverMarket;
  direction: KoreanMoverDirection;
  symbol: string;
  name: string;
  price: number;
  previousClose?: number;
  changeAmount?: number;
  changePercent?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  estimatedTurnover?: number;
  latestDate?: string;
  avgVolume20?: number;
  volumeRatio20d?: number;
  highClose20d?: number;
  highClose60d?: number;
  lowClose20d?: number;
  lowClose60d?: number;
  breakout20d: boolean;
  breakout60d: boolean;
  breakdown20d: boolean;
  breakdown60d: boolean;
  closedNearHigh: boolean;
  closedNearLow: boolean;
  alertScore: number;
  signal: KoreanMoverSignal;
  reasons: string[];
  summary: string;
};

export type RealTimePriceSpikeEvent = {
  symbol: string;
  name?: string;
  market?: KoreanMoverMarket | "KONEX";
  price: number;
  previousClose?: number;
  changePercent?: number;
  changeAmount?: number;
  volume?: number;
  volumeRatio20d?: number;
  turnoverKrw?: number;
  open?: number;
  high?: number;
  low?: number;
  breakout20d?: boolean;
  breakout60d?: boolean;
  detectedAt?: string;
  source?: string;
  note?: string;
};

export type StockUniverseItem = {
  code: string;
  name: string;
  market: "KOSPI" | "KOSDAQ" | "KONEX" | "ETF" | "ETN" | "WATCHLIST" | "KRX";
  sector?: string;
};

export type MarketWatchKey = "KOSPI" | "KOSDAQ" | "USDKRW" | "GOLD";

export type MarketWatchCategory = "index" | "fx" | "commodity";

export type MarketWatchTimeframe = "daily" | "weekly" | "yearly";

export type MarketWatchChartWindow = {
  startDate: string;
  endDate: string;
  points: ChartPoint[];
};

export type MarketWatchSnapshot = {
  key: MarketWatchKey;
  name: string;
  symbol: string;
  category: MarketWatchCategory;
  price?: number;
  previousClose?: number;
  changeAmount?: number;
  changePercent?: number;
  latestDate?: string;
  chartSets?: Partial<Record<MarketWatchTimeframe, MarketWatchChartWindow>>;
  error?: string;
};

export type FundamentalsPeriod = {
  label: string;
  isEstimated?: boolean;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  roe?: number;
  debtRatio?: number;
  eps?: number;
  bps?: number;
  per?: number;
  pbr?: number;
};

export type BusinessAreaSlice = {
  label: string;
  weight: number;
  source: "overview_estimated" | "sector_fallback";
};

export type FundamentalsSummary = {
  source: string;
  annual?: FundamentalsPeriod;
  quarterly?: FundamentalsPeriod;
  annualHistory?: FundamentalsPeriod[];
  quarterlyHistory?: FundamentalsPeriod[];
  quarterlyEstimateHistory?: FundamentalsPeriod[];
  businessAreasSource?: string;
  businessSummary?: string;
  businessAreas?: BusinessAreaSlice[];
};

export type LongTermLeaderTier = "core" | "primary" | "secondary";

export type LongTermLeaderBucket =
  | "core_leader"
  | "growth_leader"
  | "content_game"
  | "defensive_consumer"
  | "secondary_candidate";

export type LongTermScanLabel =
  | "leader correction watch"
  | "deep value review"
  | "base-forming candidate"
  | "needs more stabilization";

export type LongTermCandidateGroup = "buy candidate" | "watch candidate";

export type LongTermUniverseSeed = {
  symbol: string;
  name: string;
  bucket: LongTermLeaderBucket;
  tier: LongTermLeaderTier;
};

export type LongTermScoreBreakdown = {
  totalScore: number;
  leaderScore: number;
  correctionScore: number;
  trendScore: number;
  liquidityScore: number;
  stabilizationScore: number;
  financialScore: number;
  durabilityScore?: number;
};

export type LongTermStructureSnapshot = {
  ma60?: number;
  ma120?: number;
  ma240?: number;
  ma120Slope?: number;
  ma240Slope?: number;
  priceVsMA120Pct?: number;
  priceVsMA240Pct?: number;
};

export type LongTermBaseStructure = {
  recentLow?: number;
  distanceFromLowPct?: number;
  higherLowCount: number;
  daysSinceLastLowBreak: number;
  isStabilizing: boolean;
};

export type LongTermLiquiditySnapshot = {
  avgTurnover20?: number;
  avgTurnover60?: number;
  volumeConsistency?: number;
};

export type LongTermFinancialTrend = "improving" | "weakening" | "cyclical_downturn";

export type LongTermEarningsState = "profitable" | "temporary_loss" | "persistent_loss";

export type LongTermRoeState = "strong" | "normal" | "weak" | "negative";

export type LongTermRoeTrend = "improving" | "stable" | "deteriorating";

export type LongTermDebtState = "safe" | "manageable" | "high" | "dangerous";

export type LongTermDebtTrend = "improving" | "stable" | "worsening";

export type LongTermBusinessClarity = "clear_core_business" | "diversified" | "unclear";

export type LongTermFinancialMomentum = "improving" | "stabilizing" | "deteriorating";

export type LongTermFinancialSnapshot = {
  revenueTrend: LongTermFinancialTrend;
  operatingProfitTrend: LongTermFinancialTrend;
  netIncomeTrend: LongTermFinancialTrend;
  earningsState: LongTermEarningsState;
  roeState: LongTermRoeState;
  roeTrend: LongTermRoeTrend;
  debtState: LongTermDebtState;
  debtTrend: LongTermDebtTrend;
  businessClarity: LongTermBusinessClarity;
  financialMomentum: LongTermFinancialMomentum;
  structuralRiskFlags: string[];
  latestRoe?: number;
  latestDebtRatio?: number;
  latestPer?: number;
  latestPbr?: number;
};

export type LongTermScanCandidate = {
  symbol: string;
  name: string;
  sector?: string;
  price: number;
  high52w?: number;
  high2y?: number;
  high5y?: number;
  drawdownPct?: number;
  drawdown5yPct?: number;
  drawdownReference?: "52w" | "2y" | "5y";
  scores: LongTermScoreBreakdown;
  structure: LongTermStructureSnapshot;
  baseStructure: LongTermBaseStructure;
  liquidity: LongTermLiquiditySnapshot;
  financials?: LongTermFinancialSnapshot;
  fundamentals?: LongTermFinancialSnapshot;
  candidateGroup: LongTermCandidateGroup;
  label: LongTermScanLabel;
  reasonSummary: string;
};

export type LongTermScanFilters = {
  historySessions: number;
  recentBaseWindow: number;
  slopeLookbackSessions: number;
  higherLowLookbackWindow: number;
  higherLowPivotSpan: number;
  minimumBaseDays: number;
  minimumTradableTurnover20: number;
  minimumTradableTurnover60: number;
  minimumDrawdownPct: number;
  strongDrawdownPct: number;
  deepDrawdownPct: number;
  longCycleSupplementDrawdownPct: number;
  longCycleRecoveryThresholdPct: number;
  nearHighPenaltyPct: number;
  overextendedVsMa120Pct: number;
  farBelowMa240Pct: number;
  lowBreakPenaltyDays: number;
  coolingVolumeRatioThreshold: number;
  leaderWeight: number;
  correctionWeight: number;
  trendWeight: number;
  liquidityWeight: number;
  stabilizationWeight: number;
  financialWeight: number;
  durabilityWeight?: number;
};

export type LongTermScanResult = {
  asOfDate: string;
  universeSize: number;
  filters: LongTermScanFilters;
  candidates: LongTermScanCandidate[];
  groupedCandidates: {
    buyCandidates: LongTermScanCandidate[];
    watchCandidates: LongTermScanCandidate[];
  };
};

export type LongTermReviewAnalysis = {
  symbol: string;
  name?: string;
  market?: StockUniverseItem["market"];
  sector?: string;
  seedSource: "curated" | "ad_hoc";
  enginePass: boolean;
  filterReasons: string[];
  candidate?: LongTermScanCandidate;
};

export type NewsMetadata = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
};

export type NewsEventType =
  | "EARNINGS"
  | "CONTRACT"
  | "M&A"
  | "POLICY"
  | "CAPEX"
  | "SHAREHOLDER"
  | "RISK";

export type NewsSignalSentiment = "positive" | "negative";

export type NewsSignalCard = {
  ticker: string;
  companyName: string;
  eventType: NewsEventType;
  score: number;
  sentiment: NewsSignalSentiment;
  articleCount: number;
  sources: string[];
  timestamp: string;
  summary: string;
  newsList: NewsMetadata[];
  sector?: string;
};

export type NewsSignalSectorSummary = {
  sector: string;
  signalCount: number;
  positiveCount: number;
  negativeCount: number;
  totalScore: number;
  leadTicker: string;
  leadCompanyName: string;
};

export type NewsSignalDashboardPayload = {
  generatedAt: string;
  lastUpdatedAt: string;
  refreshIntervalMinutes: number;
  articleCount: number;
  signalCount: number;
  signals: NewsSignalCard[];
  sectors: NewsSignalSectorSummary[];
};
