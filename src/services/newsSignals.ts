import { config } from "../config.js";
import { readJson } from "../lib/http.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type {
  NewsEventType,
  NewsMetadata,
  NewsSignalCard,
  NewsSignalDashboardPayload,
  NewsSignalSectorSummary,
  NewsSignalSentiment
} from "../types.js";

type CompanyReference = {
  companyName: string;
  ticker: string;
  sector: string;
  aliases: string[];
  searchQueries?: string[];
};

type EventMatch = {
  eventType: NewsEventType;
  score: number;
  sentiment: NewsSignalSentiment;
};

type EnrichedNews = NewsMetadata & {
  companyName: string;
  ticker: string;
  sector: string;
  eventType: NewsEventType;
  baseScore: number;
  sentiment: NewsSignalSentiment;
  publishedAtMs: number;
};

type NaverNewsSearchItem = {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
};

type NaverNewsSearchResponse = {
  lastBuildDate?: string;
  total?: number;
  start?: number;
  display?: number;
  items?: NaverNewsSearchItem[];
};

const logger = createLogger("newsSignals");

const HOUR_MS = 60 * 60 * 1000;
const NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES = 5;
const NEWS_SIGNAL_REFRESH_INTERVAL_MS = NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES * 60 * 1000;
const NEWS_LOOKBACK_HOURS = 36;
const NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json";
const NAVER_NEWS_DISPLAY_COUNT = 10;
const NAVER_REQUEST_TIMEOUT_MS = 8_000;

const companyDictionary: CompanyReference[] = [
  {
    companyName: "삼성전자",
    ticker: "005930",
    sector: "반도체",
    aliases: ["삼성전자", "삼전"],
    searchQueries: ["삼성전자"]
  },
  {
    companyName: "SK하이닉스",
    ticker: "000660",
    sector: "반도체",
    aliases: ["sk하이닉스", "하이닉스"],
    searchQueries: ["SK하이닉스"]
  },
  {
    companyName: "한화오션",
    ticker: "042660",
    sector: "조선",
    aliases: ["한화오션", "대우조선해양"],
    searchQueries: ["한화오션"]
  },
  {
    companyName: "LG에너지솔루션",
    ticker: "373220",
    sector: "2차전지",
    aliases: ["lg에너지솔루션", "에너지솔루션", "lg엔솔"],
    searchQueries: ["LG에너지솔루션"]
  },
  {
    companyName: "셀트리온",
    ticker: "068270",
    sector: "제약/바이오",
    aliases: ["셀트리온"],
    searchQueries: ["셀트리온"]
  },
  {
    companyName: "카카오",
    ticker: "035720",
    sector: "인터넷/플랫폼",
    aliases: ["카카오"],
    searchQueries: ["카카오"]
  },
  {
    companyName: "HMM",
    ticker: "011200",
    sector: "해운/물류",
    aliases: ["hmm", "에이치엠엠"],
    searchQueries: ["HMM"]
  }
];

const highSeverityRiskKeywords = ["횡령", "배임", "감사의견 거절", "거래정지", "불성실공시", "상장폐지"];
const mediumSeverityRiskKeywords = ["유상증자", "전환사채", "cb", "bw", "신주인수권부사채", "불성실공시법인"];

const eventKeywordRules: Array<{ eventType: Exclude<NewsEventType, "RISK">; keywords: string[] }> = [
  {
    eventType: "CONTRACT",
    keywords: ["수주", "공급계약", "계약 체결", "납품", "공급", "수주 계약"]
  },
  {
    eventType: "EARNINGS",
    keywords: ["실적", "영업이익", "매출", "잠정", "순이익", "적자", "실적 발표"]
  },
  {
    eventType: "M&A",
    keywords: ["인수", "합병", "m&a", "지분 취득", "매각"]
  },
  {
    eventType: "POLICY",
    keywords: ["정책", "정부", "지원", "규제 완화", "국책", "예산", "보조금"]
  },
  {
    eventType: "CAPEX",
    keywords: ["증설", "투자", "공장", "라인 증설", "capex", "설비"]
  },
  {
    eventType: "SHAREHOLDER",
    keywords: ["자사주", "배당", "주주환원", "소각", "분기배당"]
  }
];

const baseScoreByEventType: Record<Exclude<NewsEventType, "RISK">, number> = {
  CONTRACT: 8,
  EARNINGS: 7,
  "M&A": 6,
  POLICY: 5,
  CAPEX: 6,
  SHAREHOLDER: 6
};

let newsSignalRefreshTimer: NodeJS.Timeout | null = null;
let newsSignalCache: NewsSignalDashboardPayload | null = null;
let hasLoggedMissingCredentials = false;

export async function initializeNewsSignalCollector(): Promise<void> {
  await refreshNewsSignalDashboard();

  if (newsSignalRefreshTimer) {
    return;
  }

  newsSignalRefreshTimer = setInterval(() => {
    void refreshNewsSignalDashboard();
  }, NEWS_SIGNAL_REFRESH_INTERVAL_MS);

  logger.info("news-signals:collector-started", {
    refreshIntervalMinutes: NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES
  });
}

export function getNewsSignalDashboard(): NewsSignalDashboardPayload {
  if (newsSignalCache) {
    return newsSignalCache;
  }

  return createEmptyNewsSignalDashboardPayload(new Date().toISOString());
}

async function refreshNewsSignalDashboard(): Promise<NewsSignalDashboardPayload> {
  const collectedAt = new Date().toISOString();

  try {
    const items = await collectNewsMetadata();
    const payload = buildNewsSignalDashboardPayload(items, collectedAt);
    newsSignalCache = payload;

    logger.info("news-signals:refreshed", {
      articleCount: payload.articleCount,
      signalCount: payload.signalCount,
      sectorCount: payload.sectors.length,
      collectedAt,
      refreshIntervalMinutes: NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES
    });

    return payload;
  } catch (error) {
    logger.error("news-signals:refresh-failed", toErrorContext(error));

    if (newsSignalCache) {
      return newsSignalCache;
    }

    const fallbackPayload = createEmptyNewsSignalDashboardPayload(collectedAt);
    newsSignalCache = fallbackPayload;
    return fallbackPayload;
  }
}

async function collectNewsMetadata(): Promise<NewsMetadata[]> {
  if (!config.naverSearchClientId || !config.naverSearchClientSecret) {
    if (!hasLoggedMissingCredentials) {
      hasLoggedMissingCredentials = true;
      logger.warn("news-signals:naver-config-missing", {
        missingClientId: !config.naverSearchClientId,
        missingClientSecret: !config.naverSearchClientSecret
      });
    }

    return [];
  }

  const settledResults = await Promise.allSettled(companyDictionary.map((company) => fetchCompanyNews(company)));
  const articles: NewsMetadata[] = [];

  settledResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
      return;
    }

    logger.warn("news-signals:company-fetch-failed", {
      companyName: companyDictionary[index]?.companyName,
      ...toErrorContext(result.reason)
    });
  });

  return dedupeNewsItems(articles)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 60);
}

async function fetchCompanyNews(company: CompanyReference): Promise<NewsMetadata[]> {
  const queryResults = await Promise.all(
    (company.searchQueries?.length ? company.searchQueries : [company.companyName]).map((query) =>
      fetchNaverNewsByQuery(company, query)
    )
  );

  return dedupeNewsItems(queryResults.flat()).filter((item) => matchesCompanyAlias(item.title, company));
}

async function fetchNaverNewsByQuery(company: CompanyReference, query: string): Promise<NewsMetadata[]> {
  const url = new URL(NAVER_NEWS_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(NAVER_NEWS_DISPLAY_COUNT));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "date");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": config.naverSearchClientId!,
      "X-Naver-Client-Secret": config.naverSearchClientSecret!
    },
    signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS)
  });
  const payload = await readJson<NaverNewsSearchResponse>(response);

  return (payload.items ?? [])
    .map((item) => normalizeNaverNewsItem(item, company))
    .filter((item): item is NewsMetadata => item != null)
    .filter((item) => isRecentNews(item.publishedAt));
}

function normalizeNaverNewsItem(item: NaverNewsSearchItem, company: CompanyReference): NewsMetadata | null {
  const title = stripTags(item.title ?? "");
  const publishedAt = normalizePublishedAt(item.pubDate);
  const url = selectArticleUrl(item);

  if (!title || !publishedAt || !url) {
    return null;
  }

  if (!matchesCompanyAlias(title, company)) {
    return null;
  }

  return {
    title,
    source: extractSourceName(url),
    publishedAt,
    url
  };
}

function normalizePublishedAt(value?: string): string | null {
  if (!value) {
    return null;
  }

  const publishedAtMs = Date.parse(value);
  if (Number.isNaN(publishedAtMs)) {
    return null;
  }

  return new Date(publishedAtMs).toISOString();
}

function selectArticleUrl(item: NaverNewsSearchItem): string | null {
  const candidates = [item.originallink, item.link]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

function matchesCompanyAlias(title: string, company: CompanyReference): boolean {
  const normalizedTitle = title.toLowerCase();
  return company.aliases.some((alias) => normalizedTitle.includes(alias.toLowerCase()));
}

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    return hostname || "unknown";
  } catch {
    return "unknown";
  }
}

function isRecentNews(publishedAt: string): boolean {
  const publishedAtMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedAtMs)) {
    return false;
  }

  const minimumPublishedAtMs = Date.now() - NEWS_LOOKBACK_HOURS * HOUR_MS;
  return publishedAtMs >= minimumPublishedAtMs;
}

function dedupeNewsItems(items: NewsMetadata[]): NewsMetadata[] {
  const seen = new Set<string>();
  const result: NewsMetadata[] = [];

  for (const item of items) {
    const dedupeKey = `${normalizeComparableText(item.title)}|${normalizeComparableText(item.url)}|${item.publishedAt}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(item);
  }

  return result;
}

function buildNewsSignalDashboardPayload(items: NewsMetadata[], collectedAt: string): NewsSignalDashboardPayload {
  const signals = buildNewsSignals(items);
  const sectors = buildSectorSummaries(signals);

  return {
    generatedAt: collectedAt,
    lastUpdatedAt: collectedAt,
    refreshIntervalMinutes: NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES,
    articleCount: items.length,
    signalCount: signals.length,
    signals,
    sectors
  };
}

function createEmptyNewsSignalDashboardPayload(collectedAt: string): NewsSignalDashboardPayload {
  return {
    generatedAt: collectedAt,
    lastUpdatedAt: collectedAt,
    refreshIntervalMinutes: NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES,
    articleCount: 0,
    signalCount: 0,
    signals: [],
    sectors: []
  };
}

export function buildNewsSignals(items: NewsMetadata[]): NewsSignalCard[] {
  const enrichedItems = items
    .map(enrichNewsItem)
    .filter((item): item is EnrichedNews => item != null);

  const buckets = new Map<string, EnrichedNews[]>();
  for (const item of enrichedItems) {
    const key = `${item.ticker}:${item.eventType}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const cards: NewsSignalCard[] = [];

  for (const bucket of buckets.values()) {
    const sortedBucket = [...bucket].sort((left, right) => left.publishedAtMs - right.publishedAtMs);
    let currentGroup: EnrichedNews[] = [];

    for (const item of sortedBucket) {
      const groupStart = currentGroup[0]?.publishedAtMs;
      if (!currentGroup.length || groupStart == null || item.publishedAtMs - groupStart <= HOUR_MS) {
        currentGroup.push(item);
        continue;
      }

      cards.push(buildSignalCard(currentGroup));
      currentGroup = [item];
    }

    if (currentGroup.length) {
      cards.push(buildSignalCard(currentGroup));
    }
  }

  return cards.sort((left, right) => {
    if (left.sentiment !== right.sentiment) {
      return left.sentiment === "negative" ? 1 : -1;
    }

    if (left.sentiment === "negative" && right.sentiment === "negative") {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return Date.parse(right.timestamp) - Date.parse(left.timestamp);
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return Date.parse(right.timestamp) - Date.parse(left.timestamp);
  });
}

function enrichNewsItem(item: NewsMetadata): EnrichedNews | null {
  const company = resolveCompanyFromTitle(item.title);
  const event = resolveEventFromTitle(item.title);
  const publishedAtMs = Date.parse(item.publishedAt);

  if (!company || !event || Number.isNaN(publishedAtMs)) {
    return null;
  }

  return {
    ...item,
    companyName: company.companyName,
    ticker: company.ticker,
    sector: company.sector,
    eventType: event.eventType,
    baseScore: event.score,
    sentiment: event.sentiment,
    publishedAtMs
  };
}

function resolveCompanyFromTitle(title: string): CompanyReference | null {
  const normalizedTitle = title.toLowerCase();

  return (
    [...companyDictionary]
      .sort((left, right) => longestAliasLength(right) - longestAliasLength(left))
      .find((company) => company.aliases.some((alias) => normalizedTitle.includes(alias.toLowerCase()))) ?? null
  );
}

function longestAliasLength(company: CompanyReference): number {
  return company.aliases.reduce((maxLength, alias) => Math.max(maxLength, alias.length), 0);
}

function resolveEventFromTitle(title: string): EventMatch | null {
  const normalizedTitle = title.toLowerCase();

  if (highSeverityRiskKeywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))) {
    return {
      eventType: "RISK",
      score: -10,
      sentiment: "negative"
    };
  }

  if (mediumSeverityRiskKeywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))) {
    return {
      eventType: "RISK",
      score: -8,
      sentiment: "negative"
    };
  }

  for (const rule of eventKeywordRules) {
    if (rule.keywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))) {
      return {
        eventType: rule.eventType,
        score: baseScoreByEventType[rule.eventType],
        sentiment: "positive"
      };
    }
  }

  return null;
}

function buildSignalCard(group: EnrichedNews[]): NewsSignalCard {
  const sortedNewsList = [...group].sort((left, right) => right.publishedAtMs - left.publishedAtMs);
  const latestNews = sortedNewsList[0];
  const uniqueSources = [...new Set(sortedNewsList.map((item) => item.source))];
  const articleBonus = Math.max(0, sortedNewsList.length - 1);
  const sourceBonus = uniqueSources.length > 1 ? 2 : 0;
  const extraScore = articleBonus + sourceBonus;
  const score =
    latestNews.sentiment === "negative" ? latestNews.baseScore - extraScore : latestNews.baseScore + extraScore;

  return {
    ticker: latestNews.ticker,
    companyName: latestNews.companyName,
    eventType: latestNews.eventType,
    score,
    sentiment: latestNews.sentiment,
    articleCount: sortedNewsList.length,
    sources: uniqueSources,
    timestamp: latestNews.publishedAt,
    summary: buildSignalSummary({
      companyName: latestNews.companyName,
      eventType: latestNews.eventType,
      articleCount: sortedNewsList.length,
      sourceCount: uniqueSources.length,
      sentiment: latestNews.sentiment
    }),
    newsList: sortedNewsList.map(({ title, source, publishedAt, url }) => ({
      title,
      source,
      publishedAt,
      url
    })),
    sector: latestNews.sector
  };
}

function buildSignalSummary(input: {
  companyName: string;
  eventType: NewsEventType;
  articleCount: number;
  sourceCount: number;
  sentiment: NewsSignalSentiment;
}): string {
  const eventSummaryByType: Record<NewsEventType, { positive: string; negative?: string }> = {
    EARNINGS: {
      positive: "실적 모멘텀이 확인됐고"
    },
    CONTRACT: {
      positive: "수주와 공급계약 모멘텀이 부각됐고"
    },
    "M&A": {
      positive: "인수합병 이슈가 재평가되고"
    },
    POLICY: {
      positive: "정책 수혜 기대가 형성되고"
    },
    CAPEX: {
      positive: "증설과 투자 계획이 확인됐고"
    },
    SHAREHOLDER: {
      positive: "자사주와 배당 등 주주환원 재료가 부각되며"
    },
    RISK: {
      positive: "리스크 이슈가 확인됐고",
      negative: "희석 또는 재무 리스크가 확산되며"
    }
  };

  const summaryPrefix =
    input.sentiment === "negative"
      ? eventSummaryByType[input.eventType].negative ?? eventSummaryByType[input.eventType].positive
      : eventSummaryByType[input.eventType].positive;
  const sourceSummary =
    input.sourceCount > 1 ? "복수 매체에서 동시 보도가 이어졌습니다." : "단일 매체 보도로 시작됐습니다.";

  return `${input.companyName}, ${summaryPrefix} 관련 기사 ${input.articleCount}건이 집중 발생했습니다. ${sourceSummary}`;
}

function buildSectorSummaries(signals: NewsSignalCard[]): NewsSignalSectorSummary[] {
  const sectorMap = new Map<string, NewsSignalCard[]>();

  for (const signal of signals) {
    const sector = signal.sector ?? "기타";
    const items = sectorMap.get(sector) ?? [];
    items.push(signal);
    sectorMap.set(sector, items);
  }

  return [...sectorMap.entries()]
    .map(([sector, items]) => {
      const sortedItems = [...items].sort((left, right) => Math.abs(right.score) - Math.abs(left.score));
      const leader = sortedItems[0];

      return {
        sector,
        signalCount: items.length,
        positiveCount: items.filter((item) => item.sentiment === "positive").length,
        negativeCount: items.filter((item) => item.sentiment === "negative").length,
        totalScore: items.reduce((sum, item) => sum + item.score, 0),
        leadTicker: leader.ticker,
        leadCompanyName: leader.companyName
      };
    })
    .sort((left, right) => {
      if (Math.abs(left.totalScore) !== Math.abs(right.totalScore)) {
        return Math.abs(right.totalScore) - Math.abs(left.totalScore);
      }

      return right.signalCount - left.signalCount;
    });
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
