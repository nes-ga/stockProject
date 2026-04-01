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
