import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  MarketEventCalendarEvent,
  MarketEventCalendarPayload,
  MarketEventCategory,
  MarketEventDailySummary,
  MarketEventImportance
} from "../types.js";

const marketEventCalendarPath = path.resolve(process.cwd(), "data", "market-event-calendar.json");
const MARKET_EVENT_TIMEZONE = "Asia/Seoul";
const categoryPriority: Record<MarketEventCategory, number> = {
  macro: 5,
  policy: 4,
  market: 3,
  earnings: 2,
  news: 1
};
const importancePriority: Record<MarketEventImportance, number> = {
  high: 3,
  medium: 2,
  low: 1
};

type RawMarketEventPayload = {
  generatedAt?: string;
  timezone?: string;
  events?: unknown[];
};

function createEmptyPayload(): MarketEventCalendarPayload {
  return {
    generatedAt: new Date().toISOString(),
    timezone: MARKET_EVENT_TIMEZONE,
    events: [],
    summaries: []
  };
}

function isCategory(value: unknown): value is MarketEventCategory {
  return value === "earnings" || value === "macro" || value === "policy" || value === "market" || value === "news";
}

function isImportance(value: unknown): value is MarketEventImportance {
  return value === "high" || value === "medium" || value === "low";
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function normalizeTime(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeEvent(raw: unknown): MarketEventCalendarEvent | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<MarketEventCalendarEvent>;
  const id = normalizeOptionalString(candidate.id);
  const date = normalizeDate(candidate.date);
  const title = normalizeOptionalString(candidate.title);
  const category = isCategory(candidate.category) ? candidate.category : null;
  const importance = isImportance(candidate.importance) ? candidate.importance : null;

  if (!id || !date || !title || !category || !importance) {
    return null;
  }

  return {
    id,
    date,
    title,
    category,
    importance,
    time: normalizeTime(candidate.time),
    ticker: normalizeOptionalString(candidate.ticker),
    companyName: normalizeOptionalString(candidate.companyName),
    location: normalizeOptionalString(candidate.location),
    description: normalizeOptionalString(candidate.description)
  };
}

function sortEvents(events: MarketEventCalendarEvent[]): MarketEventCalendarEvent[] {
  return [...events].sort((left, right) => {
    const leftDateTime = `${left.date} ${left.time ?? "23:59"}`;
    const rightDateTime = `${right.date} ${right.time ?? "23:59"}`;

    if (leftDateTime !== rightDateTime) {
      return leftDateTime.localeCompare(rightDateTime);
    }

    if (importancePriority[left.importance] !== importancePriority[right.importance]) {
      return importancePriority[right.importance] - importancePriority[left.importance];
    }

    if (categoryPriority[left.category] !== categoryPriority[right.category]) {
      return categoryPriority[right.category] - categoryPriority[left.category];
    }

    return left.title.localeCompare(right.title, "ko");
  });
}

function buildDailySummaries(events: MarketEventCalendarEvent[]): MarketEventDailySummary[] {
  const byDate = new Map<string, MarketEventCalendarEvent[]>();

  for (const event of events) {
    const items = byDate.get(event.date) ?? [];
    items.push(event);
    byDate.set(event.date, items);
  }

  return [...byDate.entries()]
    .map(([date, items]) => {
      const earningsCount = items.filter((item) => item.category === "earnings").length;
      const macroCount = items.filter((item) => item.category === "macro").length;
      const policyCount = items.filter((item) => item.category === "policy").length;
      const marketCount = items.filter((item) => item.category === "market").length;
      const newsCount = items.filter((item) => item.category === "news").length;
      const highlight = [...items].sort((left, right) => {
        if (importancePriority[left.importance] !== importancePriority[right.importance]) {
          return importancePriority[right.importance] - importancePriority[left.importance];
        }

        if (categoryPriority[left.category] !== categoryPriority[right.category]) {
          return categoryPriority[right.category] - categoryPriority[left.category];
        }

        return left.title.localeCompare(right.title, "ko");
      })[0];

      return {
        date,
        totalCount: items.length,
        earningsCount,
        macroCount,
        policyCount,
        marketCount,
        newsCount,
        otherCount: policyCount + marketCount + newsCount,
        hasHighImportance: items.some((item) => item.importance === "high"),
        highlightTitle: highlight?.importance === "high" ? highlight.title : undefined
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function getMarketEventCalendarPayload(): Promise<MarketEventCalendarPayload> {
  try {
    const raw = await readFile(marketEventCalendarPath, "utf8");
    const parsed = JSON.parse(raw) as RawMarketEventPayload;
    const events = Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent).filter(Boolean) : [];
    const normalizedEvents = sortEvents(events as MarketEventCalendarEvent[]);

    return {
      generatedAt:
        typeof parsed.generatedAt === "string" && !Number.isNaN(Date.parse(parsed.generatedAt))
          ? new Date(parsed.generatedAt).toISOString()
          : new Date().toISOString(),
      timezone: typeof parsed.timezone === "string" && parsed.timezone.trim() ? parsed.timezone : MARKET_EVENT_TIMEZONE,
      events: normalizedEvents,
      summaries: buildDailySummaries(normalizedEvents)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return createEmptyPayload();
    }

    throw error;
  }
}

export { marketEventCalendarPath };
