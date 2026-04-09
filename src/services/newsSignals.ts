import { createLogger } from "../lib/logger.js";
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

const logger = createLogger("newsSignals");

const HOUR_MS = 60 * 60 * 1000;
const NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES = 5;
const NEWS_SIGNAL_REFRESH_INTERVAL_MS = NEWS_SIGNAL_REFRESH_INTERVAL_MINUTES * 60 * 1000;

const companyDictionary: CompanyReference[] = [
  {
    companyName: "삼성전자",
    ticker: "005930",
    sector: "반도체",
    aliases: ["삼성전자", "삼전"]
  },
  {
    companyName: "SK하이닉스",
    ticker: "000660",
    sector: "반도체",
    aliases: ["SK하이닉스", "하이닉스"]
  },
  {
    companyName: "한화오션",
    ticker: "042660",
    sector: "조선",
    aliases: ["한화오션", "대우조선해양"]
  },
  {
    companyName: "LG에너지솔루션",
    ticker: "373220",
    sector: "2차전지",
    aliases: ["LG에너지솔루션", "엘지에너지솔루션", "LG엔솔"]
  },
  {
    companyName: "셀트리온",
    ticker: "068270",
    sector: "제약/바이오",
    aliases: ["셀트리온"]
  },
  {
    companyName: "카카오",
    ticker: "035720",
    sector: "인터넷/플랫폼",
    aliases: ["카카오"]
  },
  {
    companyName: "HMM",
    ticker: "011200",
    sector: "해운/물류",
    aliases: ["HMM", "에이치엠엠"]
  }
];

const highSeverityRiskKeywords = ["횡령", "배임", "감사의견 거절", "의견거절", "거래정지", "상장폐지"];
const mediumSeverityRiskKeywords = ["유상증자", "전환사채", "cb", "bw", "신주인수권부사채", "불성실공시"];

const eventKeywordRules: Array<{ eventType: Exclude<NewsEventType, "RISK">; keywords: string[] }> = [
  {
    eventType: "CONTRACT",
    keywords: ["수주", "공급계약", "계약 체결", "납품", "공급", "수주 계약"]
  },
  {
    eventType: "EARNINGS",
    keywords: ["실적", "영업이익", "매출", "잠정", "어닝", "흑자", "실적 발표"]
  },
  {
    eventType: "M&A",
    keywords: ["인수", "합병", "m&a", "지분 취득", "매각"]
  },
  {
    eventType: "POLICY",
    keywords: ["정부", "정책", "지원", "규제 완화", "국책", "예산", "보조금"]
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

const mockNewsSeed: NewsMetadata[] = [
  {
    title: "삼성전자, 1분기 잠정 영업이익 6.6조... 시장 기대 상회",
    source: "연합뉴스",
    publishedAt: "2026-04-09T09:12:00+09:00",
    url: "https://news.example.com/samsung-earnings-1"
  },
  {
    title: "삼성전자 실적 서프라이즈, 반도체 부문 회복 신호",
    source: "한국경제",
    publishedAt: "2026-04-09T09:34:00+09:00",
    url: "https://news.example.com/samsung-earnings-2"
  },
  {
    title: "증권가, 삼성전자 실적 개선에 목표가 상향 검토",
    source: "매일경제",
    publishedAt: "2026-04-09T09:48:00+09:00",
    url: "https://news.example.com/samsung-earnings-3"
  },
  {
    title: "한화오션, 2.3조 규모 LNG선 수주 계약 체결",
    source: "서울경제",
    publishedAt: "2026-04-09T08:10:00+09:00",
    url: "https://news.example.com/hanwha-contract-1"
  },
  {
    title: "한화오션, 대형 공급계약 체결로 수주잔고 확대",
    source: "이데일리",
    publishedAt: "2026-04-09T08:33:00+09:00",
    url: "https://news.example.com/hanwha-contract-2"
  },
  {
    title: "LG에너지솔루션, 미국 애리조나 공장 증설에 7조 투자",
    source: "아시아경제",
    publishedAt: "2026-04-09T10:05:00+09:00",
    url: "https://news.example.com/lges-capex-1"
  },
  {
    title: "LG에너지솔루션 추가 설비 투자 발표, 북미 생산능력 확대",
    source: "연합뉴스",
    publishedAt: "2026-04-09T10:41:00+09:00",
    url: "https://news.example.com/lges-capex-2"
  },
  {
    title: "셀트리온, 500억 규모 자사주 매입 결정",
    source: "머니투데이",
    publishedAt: "2026-04-09T12:02:00+09:00",
    url: "https://news.example.com/celltrion-shareholder-1"
  },
  {
    title: "셀트리온 주주환원 강화, 자사주 소각 가능성 주목",
    source: "한국경제",
    publishedAt: "2026-04-09T12:25:00+09:00",
    url: "https://news.example.com/celltrion-shareholder-2"
  },
  {
    title: "카카오, 자회사 유상증자 결정... 지분 희석 우려",
    source: "조선비즈",
    publishedAt: "2026-04-09T11:18:00+09:00",
    url: "https://news.example.com/kakao-risk-1"
  },
  {
    title: "카카오, 1500억 규모 CB 발행 검토 보도에 약세",
    source: "연합뉴스",
    publishedAt: "2026-04-09T11:42:00+09:00",
    url: "https://news.example.com/kakao-risk-2"
  },
  {
    title: "정부, 친환경 선박 전환 지원 확대... HMM 등 수혜 기대",
    source: "뉴시스",
    publishedAt: "2026-04-09T13:04:00+09:00",
    url: "https://news.example.com/hmm-policy-1"
  },
  {
    title: "해운업 친환경 정책 수혜주 부각, HMM 관심 확대",
    source: "서울경제",
    publishedAt: "2026-04-09T13:31:00+09:00",
    url: "https://news.example.com/hmm-policy-2"
  },
  {
    title: "SK하이닉스, HBM 투자 확대... 청주 생산라인 증설",
    source: "전자신문",
    publishedAt: "2026-04-09T14:11:00+09:00",
    url: "https://news.example.com/skh-capex-1"
  },
  {
    title: "SK하이닉스 HBM CAPEX 확대, 메모리 업황 개선 기대",
    source: "매일경제",
    publishedAt: "2026-04-09T14:46:00+09:00",
    url: "https://news.example.com/skh-capex-2"
  }
];

let newsSignalRefreshTimer: NodeJS.Timeout | null = null;
let newsSignalCache: NewsSignalDashboardPayload | null = null;

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

  const payload = buildNewsSignalDashboardPayload(collectNewsMetadata(), new Date().toISOString());
  newsSignalCache = payload;
  return payload;
}

async function refreshNewsSignalDashboard(): Promise<NewsSignalDashboardPayload> {
  const collectedAt = new Date().toISOString();
  const items = collectNewsMetadata();
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
}

function collectNewsMetadata(): NewsMetadata[] {
  return [...mockNewsSeed];
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
      positive: "실적 모멘텀이 확인되며"
    },
    CONTRACT: {
      positive: "수주/공급계약 재료가 부각되며"
    },
    "M&A": {
      positive: "인수·합병 이슈가 재평가되며"
    },
    POLICY: {
      positive: "정책 수혜 기대가 형성되며"
    },
    CAPEX: {
      positive: "증설·투자 계획이 확인되며"
    },
    SHAREHOLDER: {
      positive: "자사주·배당 등 주주환원 재료가 부각되며"
    },
    RISK: {
      positive: "리스크 이슈가 확인되며",
      negative: "희석·재무 리스크가 확산되며"
    }
  };

  const summaryPrefix =
    input.sentiment === "negative"
      ? eventSummaryByType[input.eventType].negative ?? eventSummaryByType[input.eventType].positive
      : eventSummaryByType[input.eventType].positive;
  const sourceSummary = input.sourceCount > 1 ? "다수 매체에서 동시에 보도됐습니다." : "단일 매체 보도로 포착됐습니다.";

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
