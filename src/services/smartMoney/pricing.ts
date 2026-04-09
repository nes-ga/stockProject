export type SmartMoneyPricingContext = {
  symbol?: string;
  name?: string;
};

export type SmartMoneyPriceRoundingMode = "nearest" | "up" | "down";

const KOREAN_NUMERIC_SYMBOL = /^\d{6}$/;
const ETF_NAME_PATTERNS = [
  /ETF/i,
  /ETN/i,
  /^(KODEX|TIGER|KOSEF|KBSTAR|ARIRANG|ACE|SOL|HANARO|RISE|PLUS|TIMEFOLIO|WOORI|FOCUS|1Q|TREX|UNICORN)\b/i
] as const;

function isKoreanSymbol(symbol?: string): boolean {
  return symbol != null && KOREAN_NUMERIC_SYMBOL.test(symbol.trim());
}

function isKoreanEtfLikeName(name?: string): boolean {
  if (!name) {
    return false;
  }

  return ETF_NAME_PATTERNS.some((pattern) => pattern.test(name.trim()));
}

function isKoreanEtfLike(context?: SmartMoneyPricingContext): boolean {
  return isKoreanSymbol(context?.symbol) && isKoreanEtfLikeName(context?.name);
}

function resolveKoreanStockTickSize(price: number): number {
  if (price < 2_000) {
    return 1;
  }
  if (price < 5_000) {
    return 5;
  }
  if (price < 20_000) {
    return 10;
  }
  if (price < 50_000) {
    return 50;
  }
  if (price < 200_000) {
    return 100;
  }
  if (price < 500_000) {
    return 500;
  }
  return 1_000;
}

export function resolveSmartMoneyTickSize(price: number, context?: SmartMoneyPricingContext): number {
  if (!Number.isFinite(price) || price <= 0) {
    return 0.01;
  }

  if (isKoreanEtfLike(context)) {
    return 5;
  }

  if (isKoreanSymbol(context?.symbol)) {
    return resolveKoreanStockTickSize(price);
  }

  return 0.01;
}

export function normalizePriceByTick(
  value: number | undefined,
  context?: SmartMoneyPricingContext,
  mode: SmartMoneyPriceRoundingMode = "nearest"
): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const tickSize = resolveSmartMoneyTickSize(value, context);
  if (tickSize <= 0) {
    return undefined;
  }

  const scaled = value / tickSize;
  const epsilon = 1e-9;
  const roundedUnits =
    mode === "up"
      ? Math.ceil(scaled - epsilon)
      : mode === "down"
        ? Math.floor(scaled + epsilon)
        : Math.round(scaled);
  const normalized = roundedUnits * tickSize;
  return tickSize >= 1 ? Math.round(normalized) : Math.round(normalized * 100) / 100;
}
