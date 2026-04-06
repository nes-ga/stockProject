import type { StockUniverseItem } from "../types.js";

const KRX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const eucKrDecoder = new TextDecoder("euc-kr");

const MARKET_ENDPOINTS: Array<{ market: StockUniverseItem["market"]; marketType: string }> = [
  { market: "KOSPI", marketType: "stockMkt" },
  { market: "KOSDAQ", marketType: "kosdaqMkt" },
  { market: "KONEX", marketType: "konexMkt" }
];

let stockUniverseCache:
  | {
      fetchedAt: number;
      items: StockUniverseItem[];
    }
  | undefined;

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function readEucKr(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return eucKrDecoder.decode(new Uint8Array(buffer));
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function parseCode(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  if (!normalized) {
    return undefined;
  }

  const directMatch = normalized.match(/\b[0-9A-Z]{6}\b/);
  if (directMatch) {
    return directMatch[0];
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 6) {
    return digits;
  }

  return undefined;
}

function looksLikeHeaderCell(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return (
    normalized.includes("회사명") ||
    normalized.includes("corpname") ||
    normalized.includes("종목코드") ||
    normalized === "code"
  );
}

function parseRowsFromTable(tableHtml: string, market: StockUniverseItem["market"]): StockUniverseItem[] {
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: StockUniverseItem[] = [];

  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
      stripTags(match[1])
    );

    if (cells.length < 2) {
      continue;
    }

    const name = cells[0]?.trim();
    const code = cells.slice(1).map(parseCode).find((value): value is string => value != null);
    const sector = cells[3]?.trim();
    if (!name || !code || looksLikeHeaderCell(name)) {
      continue;
    }

    items.push({
      code,
      name,
      market,
      sector: sector || undefined
    });
  }

  return items;
}

function parseCorpListRows(html: string, market: StockUniverseItem["market"]): StockUniverseItem[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  if (!tables.length) {
    return [];
  }

  const parsedTables = tables.map((tableHtml) => parseRowsFromTable(tableHtml, market));
  parsedTables.sort((left, right) => right.length - left.length);
  return parsedTables[0] ?? [];
}

async function fetchMarketUniverse(market: StockUniverseItem["market"], marketType: string): Promise<StockUniverseItem[]> {
  const url = new URL("https://kind.krx.co.kr/corpgeneral/corpList.do");
  url.searchParams.set("method", "download");
  url.searchParams.set("searchType", "13");
  url.searchParams.set("marketType", marketType);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://kind.krx.co.kr/"
    }
  });

  if (!response.ok) {
    throw new Error(`KRX universe request failed with status ${response.status}`);
  }

  const html = await readEucKr(response);
  return parseCorpListRows(html, market);
}

function dedupeUniverse(items: StockUniverseItem[]): StockUniverseItem[] {
  const map = new Map<string, StockUniverseItem>();
  for (const item of items) {
    if (!map.has(item.code)) {
      map.set(item.code, item);
    }
  }

  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

export async function getStockUniverse(options?: { forceRefresh?: boolean }) {
  const now = Date.now();
  if (!options?.forceRefresh && stockUniverseCache && now - stockUniverseCache.fetchedAt < KRX_CACHE_TTL_MS) {
    return {
      fetchedAt: new Date(stockUniverseCache.fetchedAt).toISOString(),
      count: stockUniverseCache.items.length,
      items: stockUniverseCache.items
    };
  }

  const items = dedupeUniverse(
    (
      await Promise.all(MARKET_ENDPOINTS.map(({ market, marketType }) => fetchMarketUniverse(market, marketType)))
    ).flat()
  );

  stockUniverseCache = {
    fetchedAt: now,
    items
  };

  return {
    fetchedAt: new Date(now).toISOString(),
    count: items.length,
    items
  };
}
