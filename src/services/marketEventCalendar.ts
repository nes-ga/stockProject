import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatDateInTimeZone } from "../lib/dates.js";
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

export type MarketEventCalendarSearchResult = MarketEventCalendarPayload & {
  searchedAt: string;
  addedCount: number;
};

function createEmptyPayload(): MarketEventCalendarPayload {
  return {
    generatedAt: new Date().toISOString(),
    timezone: MARKET_EVENT_TIMEZONE,
    events: [],
    summaries: []
  };
}

async function ensureCalendarDir() {
  await mkdir(path.dirname(marketEventCalendarPath), { recursive: true });
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

function addDays(dateText: string, days: number): string {
  const value = new Date(`${dateText}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getNthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number): string {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function getLastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  lastDay.setUTCDate(lastDay.getUTCDate() - offset);
  return lastDay.toISOString().slice(0, 10);
}

function createSeedEvents(today: string): MarketEventCalendarEvent[] {
  const anchor = new Date(`${today}T00:00:00.000Z`);
  const year = anchor.getUTCFullYear();
  const monthIndex = anchor.getUTCMonth();
  const nextMonthIndex = monthIndex + 1;
  const nextMonthYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedNextMonthIndex = nextMonthIndex % 12;

  const events: MarketEventCalendarEvent[] = [
    {
      id: `macro-us-gdp-${today}`,
      date: addDays(today, 2),
      time: "21:30",
      title: "미국 GDP 속보치 일정 확인",
      category: "macro",
      importance: "high",
      location: "US",
      description: "분기 성장률 발표 전후로 금리, 달러, 성장주 변동성이 커질 수 있어 확인이 필요한 일정입니다."
    },
    {
      id: `macro-us-nfp-${nextMonthYear}-${normalizedNextMonthIndex + 1}`,
      date: getNthWeekdayOfMonth(nextMonthYear, normalizedNextMonthIndex, 5, 1),
      time: "21:30",
      title: "미국 고용보고서 발표 예정",
      category: "macro",
      importance: "high",
      location: "US",
      description: "비농업고용, 실업률, 임금 지표가 함께 나오는 핵심 매크로 일정입니다."
    },
    {
      id: `macro-us-cpi-${nextMonthYear}-${normalizedNextMonthIndex + 1}`,
      date: getNthWeekdayOfMonth(nextMonthYear, normalizedNextMonthIndex, 2, 2),
      time: "21:30",
      title: "미국 CPI 발표 예정",
      category: "macro",
      importance: "high",
      location: "US",
      description: "물가 추세와 금리 기대를 확인하는 주요 일정입니다."
    },
    {
      id: `macro-kr-bok-${nextMonthYear}-${normalizedNextMonthIndex + 1}`,
      date: getLastWeekdayOfMonth(nextMonthYear, normalizedNextMonthIndex, 4),
      time: "10:00",
      title: "한국은행 금융통화위원회 일정 점검",
      category: "policy",
      importance: "high",
      location: "KR",
      description: "국내 금리, 환율, 은행·보험·건설 업종 민감도가 높아지는 정책 이벤트입니다."
    },
    {
      id: `earnings-kr-season-${year}-${monthIndex + 1}`,
      date: addDays(today, 4),
      title: "국내 주요 기업 실적 시즌 점검",
      category: "earnings",
      importance: "medium",
      location: "KR",
      description: "시가총액 상위주와 보유 관심종목의 잠정실적, 컨퍼런스콜 일정을 확인하는 구간입니다."
    },
    {
      id: `market-options-${year}-${monthIndex + 1}`,
      date: getNthWeekdayOfMonth(year, monthIndex, 4, 2),
      title: "국내 옵션 만기일",
      category: "market",
      importance: "medium",
      location: "KR",
      description: "프로그램 매매와 지수 변동성이 확대될 수 있는 정기 시장 이벤트입니다."
    },
    {
      id: `earnings-us-megacap-${today}`,
      date: addDays(today, 3),
      title: "미국 대형 기술주 실적 발표 구간",
      category: "earnings",
      importance: "high",
      location: "US",
      description: "반도체, AI, 클라우드 관련 국내 종목의 동조화 가능성을 함께 확인합니다."
    }
  ];

  return events.filter((event) => event.date >= today);
}

async function writeMarketEventCalendarPayload(payload: MarketEventCalendarPayload) {
  await ensureCalendarDir();
  await writeFile(marketEventCalendarPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function mergeEvents(existingEvents: MarketEventCalendarEvent[], nextEvents: MarketEventCalendarEvent[]) {
  const byId = new Map<string, MarketEventCalendarEvent>();
  for (const event of existingEvents) {
    byId.set(event.id, event);
  }
  let addedCount = 0;
  for (const event of nextEvents) {
    if (!byId.has(event.id)) {
      addedCount += 1;
    }
    byId.set(event.id, event);
  }
  return {
    addedCount,
    events: sortEvents([...byId.values()])
  };
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

export async function searchMarketEventCalendar(): Promise<MarketEventCalendarSearchResult> {
  const searchedAt = new Date().toISOString();
  const today = formatDateInTimeZone(new Date(), MARKET_EVENT_TIMEZONE);
  const current = await getMarketEventCalendarPayload();
  const seededEvents = createSeedEvents(today);
  const { addedCount, events } = mergeEvents(current.events, seededEvents);
  const payload: MarketEventCalendarPayload = {
    generatedAt: searchedAt,
    timezone: MARKET_EVENT_TIMEZONE,
    events,
    summaries: buildDailySummaries(events)
  };

  await writeMarketEventCalendarPayload(payload);

  return {
    ...payload,
    searchedAt,
    addedCount
  };
}

export { marketEventCalendarPath };
