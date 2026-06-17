import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatDateTimeInTimeZone, getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type { MarketOperationEvent, MarketOperationEventStatus, MarketOperationEventType } from "../types.js";

const KIND_TODAY_DISCLOSURE_URL = "https://kind.krx.co.kr/disclosure/todaydisclosure.do";
const KIND_DISCLOSURE_VIEWER_PATH = "/common/disclsviewer.do?method=search";
const KIND_MARKET_EVENT_CACHE_TTL_MS = 60 * 1000;
const KIND_MARKET_EVENT_PAGE_SIZE = 100;
const KIND_MARKET_EVENT_MAX_PAGES = 10;
const marketOperationAlertStatePath = path.resolve(process.cwd(), "data", "market-operation-event-alert-state.json");

const logger = createLogger("marketOperationEvents");

let marketOperationEventCache:
  | {
      fetchedAt: number;
      fetchedAtText: string;
      events: MarketOperationEvent[];
    }
  | undefined;
let marketOperationEventLoadPromise: Promise<{ fetchedAt: string; events: MarketOperationEvent[] }> | undefined;

type MarketOperationAlertState = {
  sentEventIds?: string[];
};

async function readMarketOperationAlertState(): Promise<MarketOperationAlertState> {
  try {
    const raw = await readFile(marketOperationAlertStatePath, "utf8");
    return JSON.parse(raw) as MarketOperationAlertState;
  } catch {
    return {};
  }
}

async function writeMarketOperationAlertState(state: MarketOperationAlertState) {
  await mkdir(path.dirname(marketOperationAlertStatePath), { recursive: true });
  await writeFile(marketOperationAlertStatePath, JSON.stringify(state, null, 2), "utf8");
}

function decodeHtml(text: string) {
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

function stripTags(html: string) {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function getAttribute(html: string, attributeName: string) {
  const match = html.match(new RegExp(`${attributeName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeHtml(match[2]) : undefined;
}

function resolveEventType(title: string): MarketOperationEventType | undefined {
  if (/side\s*car|sidecar|\uC0AC\uC774\uB4DC\uCE74/i.test(title)) {
    return "sidecar";
  }

  if (/\bCB\b|\uC11C\uD0B7|\uB9E4\uB9E4\uAC70\uB798\s*(?:\uC77C\uC2DC\uC911\uB2E8|\uC7AC\uAC1C)/i.test(title)) {
    return "circuit-breaker";
  }

  return undefined;
}

function resolveEventStatus(title: string): MarketOperationEventStatus {
  if (/\uC7AC\uAC1C|\uD574\uC81C/i.test(title)) {
    return "resolved";
  }

  if (/\uBC1C\uB3D9|\uC77C\uC2DC\uC911\uB2E8|\uC911\uB2E8/i.test(title)) {
    return "active";
  }

  return "notice";
}

function resolveMarket(title: string, submitter?: string): MarketOperationEvent["market"] {
  const haystack = `${title} ${submitter ?? ""}`;
  if (/\uCF54\uC2A4\uB2E5|KOSDAQ/i.test(haystack)) {
    return "KOSDAQ";
  }
  if (/\uC720\uAC00\uC99D\uAD8C|\uCF54\uC2A4\uD53C|KOSPI/i.test(haystack)) {
    return "KOSPI";
  }
  if (/\uD30C\uC0DD\uC0C1\uD488/i.test(haystack)) {
    return "DERIVATIVES";
  }
  return undefined;
}

function isMarketOperationTitle(title: string) {
  if (/\uAC00\uACA9\uC81C\uD55C\uD3ED\s*\uD655\uB300\uC694\uAC74/.test(title) && !/\bCB\b/i.test(title)) {
    return false;
  }

  return resolveEventType(title) != null;
}

function buildKindViewerUrl(acptNo: string, docNo?: string) {
  const url = new URL(KIND_DISCLOSURE_VIEWER_PATH, "https://kind.krx.co.kr");
  url.searchParams.set("acptno", acptNo);
  url.searchParams.set("docno", docNo ?? "");
  return url.toString();
}

function parseTotalPages(html: string) {
  const match = html.match(/<strong>\s*\d+\s*<\/strong>\s*\/\s*(\d+)/i);
  const pageCount = match ? Number(match[1]) : 1;
  return Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;
}

function parseKindDisclosureRows(html: string, date: string): MarketOperationEvent[] {
  const rowRegex = /<tr\b[^>]*id=["']parkman["'][^>]*>([\s\S]*?)<\/tr>/gi;
  const events: MarketOperationEvent[] = [];

  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    const time = cells[0]?.match(/\d{2}:\d{2}/)?.[0];
    const submitter = cells[3] || undefined;
    const viewerMatch = rowHtml.match(/openDisclsViewer\('([^']+)'\s*,\s*'([^']*)'\)/i);
    const titleAnchorMatch = rowHtml.match(/<a\b[^>]*href=["']#viewer["'][^>]*>[\s\S]*?<\/a>/i);
    const title = titleAnchorMatch ? getAttribute(titleAnchorMatch[0], "title") ?? stripTags(titleAnchorMatch[0]) : undefined;

    if (!viewerMatch || !title || !isMarketOperationTitle(title)) {
      continue;
    }

    const [, acptNo, docNo] = viewerMatch;
    const eventType = resolveEventType(title);
    if (!eventType) {
      continue;
    }

    events.push({
      id: `kind:${acptNo}`,
      eventType,
      status: resolveEventStatus(title),
      market: resolveMarket(title, submitter),
      title,
      submitter,
      occurredAt: time ? `${date} ${time}` : date,
      source: "kind",
      sourceUrl: buildKindViewerUrl(acptNo, docNo)
    });
  }

  return events;
}

async function fetchKindTodayDisclosurePage(date: string, pageIndex: number) {
  const body = new URLSearchParams({
    method: "searchTodayDisclosureSub",
    currentPageSize: String(KIND_MARKET_EVENT_PAGE_SIZE),
    pageIndex: String(pageIndex),
    orderMode: "0",
    orderStat: "D",
    forward: "todaydisclosure_sub",
    chose: "day",
    todayFlag: "N",
    selDate: date,
    searchCodeType: "",
    searchCorpName: "",
    repIsuSrtCd: "",
    marketType: "",
    disclosureType: "",
    paxreq: ""
  });

  const response = await fetch(KIND_TODAY_DISCLOSURE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      "Referer": `${KIND_TODAY_DISCLOSURE_URL}?method=searchTodayDisclosureMain`
    },
    body
  });

  if (!response.ok) {
    throw new Error(`KIND market operation event request failed with status ${response.status}`);
  }

  return response.text();
}

function sortMarketOperationEvents(events: MarketOperationEvent[]) {
  return [...events].sort((left, right) => String(right.occurredAt ?? "").localeCompare(String(left.occurredAt ?? "")));
}

async function loadMarketOperationEvents() {
  const date = getCurrentIsoDate(SEOUL_TIME_ZONE);
  const firstPageHtml = await fetchKindTodayDisclosurePage(date, 1);
  const pageCount = Math.min(parseTotalPages(firstPageHtml), KIND_MARKET_EVENT_MAX_PAGES);
  const pageHtmls = [firstPageHtml];

  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => fetchKindTodayDisclosurePage(date, index + 2))
    );
    pageHtmls.push(...rest);
  }

  const byId = new Map<string, MarketOperationEvent>();
  for (const html of pageHtmls) {
    for (const event of parseKindDisclosureRows(html, date)) {
      byId.set(event.id, event);
    }
  }

  const events = sortMarketOperationEvents([...byId.values()]);
  const fetchedAtText = formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE);
  marketOperationEventCache = {
    fetchedAt: Date.now(),
    fetchedAtText,
    events
  };

  logger.info("events:load:success", {
    date,
    pageCount,
    count: events.length
  });

  return {
    fetchedAt: fetchedAtText,
    events
  };
}

export async function getMarketOperationEvents(options?: { forceRefresh?: boolean }) {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    marketOperationEventCache &&
    now - marketOperationEventCache.fetchedAt < KIND_MARKET_EVENT_CACHE_TTL_MS
  ) {
    return {
      fetchedAt: marketOperationEventCache.fetchedAtText,
      events: marketOperationEventCache.events
    };
  }

  if (!options?.forceRefresh && marketOperationEventLoadPromise) {
    return marketOperationEventLoadPromise;
  }

  marketOperationEventLoadPromise = loadMarketOperationEvents()
    .catch((error) => {
      logger.warn("events:load:failed", toErrorContext(error));
      return {
        fetchedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE),
        events: []
      };
    })
    .finally(() => {
      marketOperationEventLoadPromise = undefined;
    });

  return marketOperationEventLoadPromise;
}

export function buildMarketOperationEventDiscordMessages(params: {
  events: MarketOperationEvent[];
  mention?: string;
}) {
  const { events, mention } = params;
  if (!events.length) {
    return [];
  }

  const lines = [
    mention?.trim(),
    "KRX/KIND market operation alerts",
    ...events.map((event) =>
      [
        `[${event.market ?? "MARKET"}] ${event.title}`,
        event.occurredAt ? `time=${event.occurredAt}` : undefined,
        event.submitter ? `submitter=${event.submitter}` : undefined,
        event.sourceUrl
      ]
        .filter(Boolean)
        .join(" | ")
    )
  ].filter(Boolean);

  return [lines.join("\n")];
}

export async function filterUnsentMarketOperationEvents(events: MarketOperationEvent[]) {
  const state = await readMarketOperationAlertState();
  const sentIds = new Set(state.sentEventIds ?? []);
  return events.filter((event) => !sentIds.has(event.id));
}

export async function rememberMarketOperationEventAlerts(events: MarketOperationEvent[]) {
  if (!events.length) {
    return;
  }

  const state = await readMarketOperationAlertState();
  const sentIds = new Set(state.sentEventIds ?? []);
  for (const event of events) {
    sentIds.add(event.id);
  }

  await writeMarketOperationAlertState({
    sentEventIds: [...sentIds].sort()
  });
}

export { marketOperationAlertStatePath };
