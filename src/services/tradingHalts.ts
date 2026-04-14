import type {
  StockUniverseItem,
  TradingHaltAction,
  TradingHaltCategory,
  TradingHaltReasonCategory
} from "../types.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import { getStockUniverse } from "./stockUniverse.js";

type TradingHaltMarket = Extract<StockUniverseItem["market"], "KOSPI" | "KOSDAQ" | "KONEX">;

export type TradingHaltItem = {
  name: string;
  market: TradingHaltMarket;
  reason: string;
  reasonCategory: TradingHaltReasonCategory;
  haltCategory: TradingHaltCategory;
  haltAction: TradingHaltAction;
  asOfDate?: string;
  symbol?: string;
};

const TRADING_HALT_CACHE_TTL_MS = 30 * 60 * 1000;
const logger = createLogger("tradingHalts");

const MARKET_ENDPOINTS: Array<{ market: TradingHaltMarket; marketType: string }> = [
  { market: "KOSPI", marketType: "1" },
  { market: "KOSDAQ", marketType: "2" },
  { market: "KONEX", marketType: "6" }
];

let tradingHaltCache:
  | {
      fetchedAt: number;
      items: TradingHaltItem[];
    }
  | undefined;
let tradingHaltLoadPromise: Promise<TradingHaltItem[]> | undefined;
let tradingHaltLookupCache:
  | {
      fetchedAt: number;
      bySymbol: Map<string, TradingHaltItem>;
    }
  | undefined;
let tradingHaltLookupPromise: Promise<Map<string, TradingHaltItem>> | undefined;

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

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function normalizeName(value: string): string {
  return value.replace(/[^0-9A-Z\uAC00-\uD7A3]+/giu, "").toUpperCase();
}

function parseAsOfDate(html: string): string | undefined {
  const match = html.match(/(\d{4})\uB144\s*(\d{1,2})\uC6D4\s*(\d{1,2})\uC77C\s*\uD604\uC7AC/u);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function resolveReasonCategory(reason: string): TradingHaltReasonCategory {
  if (
    includesAny(reason, [
      /\uBCD1\uD569/u,
      /\uBD84\uD560/u,
      /\uC804\uC790\uB4F1\uB85D\s*\uBCC0\uACBD/u,
      /\uB9D0\uC18C/u,
      /SPAC\s*\uD569\uBCD1/iu,
      /\uD569\uBCD1/u,
      /\uACF5\uAC1C\uB9E4\uC218/u,
      /\uC720\uC0C1\uC99D\uC790/u
    ])
  ) {
    return "corporate_action";
  }

  if (
    includesAny(reason, [
      /\uAC10\uC0AC\uC758\uACAC\uAC70\uC808/u,
      /\uC0C1\uC7A5\uD3D0\uC9C0/u,
      /\uC2E4\uC9C8\uC2EC\uC0AC/u,
      /\uD68C\uC0DD\uC808\uCC28/u,
      /\uD68C\uACC4/u,
      /\uBD88\uC131\uC2E4\uACF5\uC2DC/u,
      /\uC815\uAE30\uBCF4\uACE0\uC11C/u,
      /\uC9C0\uC5F0\uC81C\uCD9C/u,
      /\uD22C\uC790\uC790\s*\uBCF4\uD638/u,
      /\uACF5\uC775/u
    ])
  ) {
    return "regulatory_risk";
  }

  if (
    includesAny(reason, [
      /\uD22C\uC790\uC720\uC758/u,
      /\uD22C\uC790\uACBD\uACE0/u,
      /\uD22C\uC790\uC704\uD5D8/u,
      /\uD48D\uBB38/u,
      /\uAE09\uBCC0/u,
      /\uBCC0\uB3D9\uC131/u
    ])
  ) {
    return "market_warning";
  }

  return "other";
}

function resolveHaltCategory(reason: string): TradingHaltCategory {
  if (
    includesAny(reason, [
      /\uAC10\uC0AC\uC758\uACAC\uAC70\uC808/u,
      /\uC0C1\uC7A5\uD3D0\uC9C0/u,
      /\uD68D\uB839/u,
      /\uBC30\uC784/u,
      /\uD68C\uC0DD\uC808\uCC28/u,
      /\uC2E4\uC9C8\uC2EC\uC0AC/u
    ])
  ) {
    return "critical";
  }

  if (
    includesAny(reason, [
      /\uBD88\uC131\uC2E4\uACF5\uC2DC/u,
      /\uC9C0\uC5F0\uC81C\uCD9C/u,
      /\uC815\uAE30\uBCF4\uACE0\uC11C/u,
      /\uACF5\uC2DC\uC704\uBC18/u
    ])
  ) {
    return "structural";
  }

  if (
    includesAny(reason, [
      /\uBCD1\uD569/u,
      /\uBD84\uD560/u,
      /\uC804\uC790\uB4F1\uB85D\s*\uBCC0\uACBD/u,
      /\uB9D0\uC18C/u,
      /SPAC\s*\uD569\uBCD1/iu,
      /\uD569\uBCD1/u,
      /\uACF5\uAC1C\uB9E4\uC218/u,
      /\uC720\uC0C1\uC99D\uC790/u,
      /\uB9E4\uC218\uCCAD\uAD6C/u
    ])
  ) {
    return "event";
  }

  if (
    includesAny(reason, [
      /\uD22C\uC790\uC720\uC758/u,
      /\uD22C\uC790\uACBD\uACE0/u,
      /\uD22C\uC790\uC704\uD5D8/u,
      /\uD48D\uBB38/u,
      /\uAE09\uBCC0/u,
      /\uBCC0\uB3D9\uC131/u
    ])
  ) {
    return "technical";
  }

  return "other";
}

function resolveHaltAction(haltCategory: TradingHaltCategory): TradingHaltAction {
  switch (haltCategory) {
    case "critical":
      return "exclude";
    case "structural":
      return "exclude";
    case "technical":
      return "watch_only";
    case "event":
      return "allow_with_penalty";
    default:
      return "watch_only";
  }
}

function parseTradingHaltRows(html: string, market: TradingHaltMarket): TradingHaltItem[] {
  const tableMatch = html.match(/<table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/iu);
  if (!tableMatch) {
    return [];
  }

  const asOfDate = parseAsOfDate(html);
  const rows = tableMatch[1].match(/<tr[\s\S]*?<\/tr>/giu) ?? [];
  const items: TradingHaltItem[] = [];

  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/giu)].map((match) =>
      stripTags(match[1])
    );

    if (cells.length < 3) {
      continue;
    }

    const name = cells[1]?.trim();
    const reason = cells[2]?.trim();
    if (!name || !reason || name === "\uC885\uBAA9\uBA85" || reason === "\uC0AC\uC720") {
      continue;
    }

    const haltCategory = resolveHaltCategory(reason);
    items.push({
      name,
      market,
      reason,
      reasonCategory: resolveReasonCategory(reason),
      haltCategory,
      haltAction: resolveHaltAction(haltCategory),
      asOfDate
    });
  }

  return items;
}

async function fetchMarketTradingHalts(market: TradingHaltMarket, marketType: string): Promise<TradingHaltItem[]> {
  logger.info("trading-halts:load:start", {
    market
  });

  const body = new URLSearchParams({
    method: "searchTradingHaltIssueSub",
    forward: "tradinghaltissue_sub",
    pageIndex: "1",
    currentPageSize: "3000",
    marketType,
    repIsuSrtCd: "",
    searchCorpName: "",
    searchMode: "",
    searchCodeType: "",
    paxreq: "",
    outsvcno: ""
  });

  const response = await fetch("https://kind.krx.co.kr/investwarn/tradinghaltissue.do", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://kind.krx.co.kr/investwarn/tradinghaltissue.do?method=searchTradingHaltIssueMain"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`KIND trading halt request failed with status ${response.status} for ${market}`);
  }

  const html = await response.text();
  const items = parseTradingHaltRows(html, market);

  logger.info("trading-halts:load:success", {
    market,
    count: items.length,
    asOfDate: items[0]?.asOfDate
  });

  return items;
}

export async function getTradingHaltItems(options?: { forceRefresh?: boolean }) {
  const now = Date.now();
  if (!options?.forceRefresh && tradingHaltCache && now - tradingHaltCache.fetchedAt < TRADING_HALT_CACHE_TTL_MS) {
    return tradingHaltCache.items;
  }

  if (!options?.forceRefresh && tradingHaltLoadPromise) {
    return tradingHaltLoadPromise;
  }

  const nextLoad = Promise.all(
    MARKET_ENDPOINTS.map(({ market, marketType }) => fetchMarketTradingHalts(market, marketType))
  )
    .then((result) => result.flat())
    .then((items) => {
      tradingHaltCache = {
        fetchedAt: Date.now(),
        items
      };
      tradingHaltLookupCache = undefined;
      return items;
    })
    .catch((error) => {
      logger.error("trading-halts:load:failed", toErrorContext(error));
      throw error;
    })
    .finally(() => {
      tradingHaltLoadPromise = undefined;
    });

  tradingHaltLoadPromise = nextLoad;
  return nextLoad;
}

export async function getTradingHaltLookup(options?: { forceRefresh?: boolean }) {
  const now = Date.now();
  if (!options?.forceRefresh && tradingHaltLookupCache && now - tradingHaltLookupCache.fetchedAt < TRADING_HALT_CACHE_TTL_MS) {
    return tradingHaltLookupCache.bySymbol;
  }

  if (!options?.forceRefresh && tradingHaltLookupPromise) {
    return tradingHaltLookupPromise;
  }

  const nextLookup = Promise.all([
    getTradingHaltItems(options),
    getStockUniverse({ forceRefresh: options?.forceRefresh })
  ])
    .then(([items, universe]) => {
      const haltByName = new Map<string, TradingHaltItem>();
      for (const item of items) {
        haltByName.set(`${item.market}:${normalizeName(item.name)}`, item);
      }

      const bySymbol = new Map<string, TradingHaltItem>();
      for (const item of universe.items) {
        if (item.market !== "KOSPI" && item.market !== "KOSDAQ" && item.market !== "KONEX") {
          continue;
        }

        const matched = haltByName.get(`${item.market}:${normalizeName(item.name)}`);
        if (!matched) {
          continue;
        }

        bySymbol.set(item.code, {
          ...matched,
          symbol: item.code,
          name: item.name
        });
      }

      tradingHaltLookupCache = {
        fetchedAt: Date.now(),
        bySymbol
      };

      return bySymbol;
    })
    .finally(() => {
      tradingHaltLookupPromise = undefined;
    });

  tradingHaltLookupPromise = nextLookup;
  return nextLookup;
}

export async function getTradingHaltInfoBySymbol(symbol: string, options?: { forceRefresh?: boolean }) {
  const normalizedSymbol = symbol.match(/\d{6}/)?.[0] ?? symbol.toUpperCase();
  const lookup = await getTradingHaltLookup(options);
  return lookup.get(normalizedSymbol);
}
