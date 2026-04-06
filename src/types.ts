export type BandPost = {
  postKey?: string;
  content: string;
  author?: string;
  createdAt?: string;
  photos?: string[];
  raw?: unknown;
};

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

export type SmartMoneyMarketContext = {
  asOfDate?: string;
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

export type SmartMoneyRejectReason = {
  stage: "setup" | "breakout";
  lookbackWindowDays: number;
  leadInDate?: string;
  candidateDate?: string;
  reason: string;
};

export type SmartMoneyCandidateSummary = {
  stage: "setup" | "breakout";
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

export type FundamentalsSummary = {
  source: string;
  annual?: FundamentalsPeriod;
  quarterly?: FundamentalsPeriod;
};
