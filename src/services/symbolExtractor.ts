const stopWords = new Set([
  "BUY",
  "SELL",
  "HOLD",
  "POST",
  "API",
  "USD",
  "KRW",
  "PER",
  "PBR",
  "ETF"
]);

export function extractStockSymbols(input: string): string[] {
  const results = new Set<string>();
  const upper = input.toUpperCase();

  const usTickerMatches = upper.match(/\b[A-Z]{1,5}\b/g) ?? [];
  for (const token of usTickerMatches) {
    if (!stopWords.has(token)) {
      results.add(token);
    }
  }

  const krxMatches = input.match(/\b\d{6}\b/g) ?? [];
  for (const token of krxMatches) {
    results.add(token);
  }

  return [...results];
}

export function resolveFinanceSymbol(symbol: string, defaultMarketSuffix: string): string {
  if (/^\d{6}$/.test(symbol)) {
    return `${symbol}${defaultMarketSuffix}`;
  }
  return symbol.toUpperCase();
}
