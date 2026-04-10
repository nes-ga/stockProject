import { config } from "../config.js";
import type {
  KoreanMoverAnalysis,
  KoreanMoverDirection,
  KoreanMoverMarket,
  RecommendationPatternAnalysis,
  RecommendationPatternFilters,
  SmartMoneyPatternAnalysis,
  SmartMoneyPatternFilters
} from "../types.js";
import type {
  RecommendationUniverseAlertBucket,
  RecommendationUniverseAlertCategory,
  RecommendationUniverseAlertDiff
} from "./recommendationUniverseAlerts.js";

type KoreanMoverAlertFilters = {
  direction: KoreanMoverDirection;
  market: "all" | KoreanMoverMarket;
  limit: number;
  minChangePercent: number;
  minVolumeRatio: number;
  minAlertScore: number;
};

function nowInSeoul(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function formatNumber(value?: number, maximumFractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits
  }).format(value);
}

function formatSignal(signal: KoreanMoverAnalysis["signal"]): string {
  if (signal === "explosive") {
    return "폭발";
  }
  if (signal === "strong") {
    return "강함";
  }
  return "관찰";
}

function buildAlertLines(analyses: KoreanMoverAnalysis[]) {
  return analyses.map((item, index) => {
    const parts = [
      `${index + 1}. [${item.market}] ${item.name}(${item.symbol})`,
      `등락률 ${formatNumber(item.changePercent)}%`,
      `점수 ${item.alertScore}`,
      `신호 ${formatSignal(item.signal)}`
    ];

    if (item.volumeRatio20d != null) {
      parts.push(`거래량 ${formatNumber(item.volumeRatio20d)}배`);
    }

    if (item.estimatedTurnover != null) {
      parts.push(`거래대금 약 ${formatNumber(item.estimatedTurnover / 100_000_000, 0)}억`);
    }

    const reasonText = item.reasons.slice(0, 2).join(", ");
    return `${parts.join(" | ")}${reasonText ? `\n- ${reasonText}` : ""}`;
  });
}

function chunkMessages(lines: string[], header: string, maxLength = 1800): string[] {
  const messages: string[] = [];
  let current = header;

  for (const line of lines) {
    const next = `${current}\n${line}`;
    if (next.length > maxLength) {
      messages.push(current);
      current = `${header}\n${line}`;
      continue;
    }
    current = next;
  }

  if (current.trim()) {
    messages.push(current);
  }

  return messages;
}

export function buildKoreanMoversDiscordMessages(params: {
  analyses: KoreanMoverAnalysis[];
  filters: KoreanMoverAlertFilters;
  mention?: string;
}) {
  const { analyses, filters, mention } = params;
  const headerParts = [
    mention?.trim(),
    `한국 급등주 알람`,
    `기준 ${nowInSeoul()} KST`,
    `(direction=${filters.direction}, market=${filters.market}, minChange=${filters.minChangePercent}, minVol=${filters.minVolumeRatio}, minScore=${filters.minAlertScore})`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  if (!analyses.length) {
    return [`${header}\n조건을 만족한 종목이 없습니다.`];
  }

  return chunkMessages(buildAlertLines(analyses), header);
}

function formatPercent(value?: number, maximumFractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return `${formatNumber(value, maximumFractionDigits)}%`;
}

function formatSwingStatusLabel(status?: SmartMoneyPatternAnalysis["pattern"]["status"]): string {
  switch (status) {
    case "pivot_formed":
      return "\uAE30\uC900 \uD615\uC131";
    case "pullback_early":
      return "\uB20C\uB9BC \uCD08\uAE30";
    case "pullback_deep":
      return "\uAE4A\uC740 \uB20C\uB9BC";
    case "pullback_ready":
      return "\uB20C\uB9BC \uC900\uBE44";
    case "buy_ready":
      return "1\uCC28 \uB9E4\uC218 \uAD6C\uAC04";
    case "breakout_extended":
      return "\uCD94\uACA9 \uAE08\uC9C0";
    case "breakout_ready":
      return "\uB3CC\uD30C \uB300\uAE30";
    case "breakout_confirmed":
      return "\uB3CC\uD30C \uD655\uC778";
    case "broken":
      return "\uC774\uD0C8";
    default:
      return "\uAD00\uCC30";
  }
}

function formatSwingStatus(status?: SmartMoneyPatternAnalysis["pattern"]["status"]): string {
  switch (status) {
    case "pivot_formed":
      return "기준봉 형성";
    case "pullback_early":
      return "눌림 초기";
    case "pullback_ready":
      return "눌림 완성";
    case "buy_ready":
      return "1차 매수 가능";
    case "breakout_ready":
      return "재돌파 대기";
    case "breakout_confirmed":
      return "재돌파 확인";
    case "broken":
      return "이탈";
    default:
      return "관찰 전";
  }
}

function formatEntryStrategy(entryStrategy?: SmartMoneyPatternAnalysis["pattern"]["entryStrategy"]): string {
  switch (entryStrategy) {
    case "pullback_buy":
      return "눌림매수";
    case "breakout_ready":
      return "돌파대기";
    case "breakout_confirmed":
      return "돌파확인";
    default:
      return "-";
  }
}

function formatSwingStatusDisplay(status?: SmartMoneyPatternAnalysis["pattern"]["status"]): string {
  switch (status) {
    case "pivot_formed":
      return "\uAE30\uC900\uBD09 \uD615\uC131";
    case "pullback_early":
      return "\uB20C\uB9BC \uCD08\uAE30";
    case "pullback_deep":
      return "\uAE4A\uC740 \uB20C\uB9BC";
    case "pullback_ready":
      return "\uB20C\uB9BC \uC644\uC131";
    case "buy_ready":
      return "1\uCC28\uB9E4\uC218 \uAC00\uB2A5";
    case "breakout_extended":
      return "\uCD94\uACA9 \uAE08\uC9C0";
    case "breakout_ready":
      return "\uB3CC\uD30C \uB300\uAE30";
    case "breakout_confirmed":
      return "\uB3CC\uD30C \uD655\uC778";
    case "broken":
      return "\uC774\uD0C8";
    default:
      return "\uAD00\uCC30";
  }
}

function formatEntryStrategyDisplay(entryStrategy?: SmartMoneyPatternAnalysis["pattern"]["entryStrategy"]): string {
  switch (entryStrategy) {
    case "pullback_buy":
      return "\uB20C\uB9BC \uB9E4\uC218";
    case "no_chase":
      return "\uCD94\uACA9 \uAE08\uC9C0";
    case "breakout_ready":
      return "\uB3CC\uD30C \uB300\uAE30";
    case "breakout_confirmed":
      return "\uB3CC\uD30C \uD655\uC778";
    default:
      return "-";
  }
}

function formatPriceBand(low?: number, high?: number): string {
  if (low == null && high == null) {
    return "-";
  }
  if (low != null && high != null) {
    return `${formatNumber(low, 0)}~${formatNumber(high, 0)}`;
  }
  return formatNumber(high ?? low, 0);
}

function formatBuyPlan(buyPlan?: SmartMoneyPatternAnalysis["pattern"]["buyPlan"]): string {
  if (!buyPlan) {
    return "-";
  }

  return `${formatNumber(buyPlan.firstBuyPrice, 0)}/${formatNumber(buyPlan.secondBuyPrice, 0)}/${formatNumber(buyPlan.thirdBuyPrice, 0)}`;
}

function formatStopReference(pattern: SmartMoneyPatternAnalysis["pattern"]): string {
  if (!pattern.stopLossReferenceDate && !pattern.stopLossReferenceType) {
    return "-";
  }

  const basis = pattern.stopLossReferenceType === "close_fallback" ? "close" : "low";
  return `${pattern.stopLossReferenceDate ?? "-"} ${basis}`;
}

function buildRecommendationPatternLines(analyses: RecommendationPatternAnalysis[]) {
  return analyses.map((item, index) => {
    const { pattern } = item;
    const parts = [
      `${index + 1}. ${item.name ?? item.symbol} (${item.symbol})`,
      `anchor ${item.tradingAnchorDate}`,
      `signal ${pattern.signalDate ?? "-"}`,
      `score ${pattern.signalScore}`,
      `price ${formatPercent(pattern.priceChangePercent)}`,
      `vol ${formatNumber(pattern.volumeRatio20d)}x`
    ];

    if (pattern.sessionsBeforeAnchor != null) {
      parts.push(`${pattern.sessionsBeforeAnchor} sessions before anchor`);
    }

    const reasonText = pattern.reasons.slice(0, 2).join(", ");
    return `${parts.join(" | ")}${reasonText ? `\n- ${reasonText}` : ""}`;
  });
}

export function buildRecommendationPatternDiscordMessages(params: {
  analyses: RecommendationPatternAnalysis[];
  filters: RecommendationPatternFilters;
  mention?: string;
}) {
  const { analyses, filters, mention } = params;
  const headerParts = [
    mention?.trim(),
    "Pre-anchor momentum pattern alerts",
    `Generated ${nowInSeoul()} KST`,
    `lookback=${filters.lookbackTradingDays}, minPrice=${filters.minPriceChangePercent}, minVol=${filters.minVolumeRatio}, minScore=${filters.minSignalScore}, requireBreakout=${filters.requireBreakout}`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  if (!analyses.length) {
    return [`${header}\nNo symbols matched the configured pre-anchor momentum pattern.`];
  }

  return chunkMessages(buildRecommendationPatternLines(analyses), header);
}

function buildSmartMoneyPatternLines(analyses: SmartMoneyPatternAnalysis[]) {
  return analyses.map((item, index) => {
    const { pattern } = item;
    const watchOnly = pattern.status === "breakout_extended" || pattern.entryStrategy === "no_chase";
    const parts = [
      `${index + 1}. ${watchOnly ? "[WATCH-ONLY] " : ""}${item.name ?? item.symbol} (${item.symbol})`,
      `status ${formatSwingStatusLabel(pattern.status)}`,
      `style ${formatEntryStrategyDisplay(pattern.entryStrategy)}`,
      `ref ${item.tradingReferenceDate}`,
      `lead ${pattern.leadInDate ?? "-"}`,
      `breakout ${pattern.breakoutDate ?? "-"}`,
      `entry ${formatPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh)}`,
      `sma20 ${formatNumber(pattern.referenceSma20, 0)}`,
      `buy ${formatBuyPlan(pattern.buyPlan)}`,
      `stop ${formatNumber(pattern.buyPlan?.stopLossPrice ?? pattern.invalidationPrice, 0)}`,
      `stopRef ${formatStopReference(pattern)}`,
      `invalid ${formatNumber(pattern.invalidationPrice, 0)}`,
      `breakout ${formatPercent(pattern.breakoutPriceChangePercent)}`,
      `vol ${formatNumber(pattern.breakoutVolumeRatio20d)}x`
    ];

    if (pattern.sessionsSinceBreakout != null) {
      parts.push(`since ${pattern.sessionsSinceBreakout} sessions`);
    }

    const reasonText = pattern.reasons.slice(0, 2).join(", ");
    return `${parts.join(" | ")}${reasonText ? `\n- ${reasonText}` : ""}`;
  });
}

export function buildSmartMoneyPatternDiscordMessages(params: {
  analyses: SmartMoneyPatternAnalysis[];
  filters: SmartMoneyPatternFilters;
  mention?: string;
}) {
  const { analyses, filters, mention } = params;
  const headerParts = [
    mention?.trim(),
    "Smart-money entry pattern alerts",
    `Generated ${nowInSeoul()} KST`,
    `lookbacks=${filters.lookbackWindows.join("/")}, leadVol=${filters.minLeadInVolumeRatio}, breakoutVol=${filters.minBreakoutVolumeRatio}, minTurnover=${Math.round(filters.minTurnoverValue).toLocaleString("ko-KR")}, recent=${filters.recentSignalSessions}`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  if (!analyses.length) {
    return [`${header}\nNo symbols matched the smart-money entry pattern.`];
  }

  const sortedAnalyses = [...analyses].sort((left, right) => {
    const leftWatchOnly = left.pattern.status === "breakout_extended" || left.pattern.entryStrategy === "no_chase";
    const rightWatchOnly = right.pattern.status === "breakout_extended" || right.pattern.entryStrategy === "no_chase";
    if (leftWatchOnly !== rightWatchOnly) {
      return leftWatchOnly ? 1 : -1;
    }
    const leftScore = left.pattern.finalRankScore ?? left.pattern.patternScore ?? 0;
    const rightScore = right.pattern.finalRankScore ?? right.pattern.patternScore ?? 0;
    return rightScore - leftScore;
  });
  const primaryAnalyses = sortedAnalyses.filter(
    (item) => item.pattern.status !== "breakout_extended" && item.pattern.entryStrategy !== "no_chase"
  );
  const watchOnlyAnalyses = sortedAnalyses.filter(
    (item) => item.pattern.status === "breakout_extended" || item.pattern.entryStrategy === "no_chase"
  );
  const lines = [
    ...buildSmartMoneyPatternLines(primaryAnalyses),
    ...(watchOnlyAnalyses.length ? ["Watch-only / no-chase", ...buildSmartMoneyPatternLines(watchOnlyAnalyses)] : [])
  ];

  return chunkMessages(lines, header);
}

function formatRecommendationUniverseCategory(category: RecommendationUniverseAlertCategory) {
  return category === "swing" ? "스윙" : "중장기";
}

function formatRecommendationUniverseBucket(
  category: RecommendationUniverseAlertCategory,
  bucket?: RecommendationUniverseAlertBucket
) {
  if (!bucket) {
    return "-";
  }

  if (category === "swing") {
    return bucket === "execution" ? "매수후보" : "관찰후보";
  }

  return bucket === "buy" ? "매수후보군" : "관찰군";
}

function buildRecommendationUniverseAlertLines(diff: RecommendationUniverseAlertDiff) {
  return diff.changes.map((change, index) => {
    const prefix = `${index + 1}. ${change.name} (${change.symbol})`;

    if (change.type === "added") {
      return `${prefix} | 신규 편입 | ${formatRecommendationUniverseBucket(diff.category, change.toBucket)}`;
    }

    if (change.type === "removed") {
      return `${prefix} | 제외 | ${formatRecommendationUniverseBucket(diff.category, change.fromBucket)}`;
    }

    return `${prefix} | 이동 | ${formatRecommendationUniverseBucket(diff.category, change.fromBucket)} -> ${formatRecommendationUniverseBucket(diff.category, change.toBucket)}`;
  });
}

export function buildRecommendationUniverseDiscordMessages(params: {
  diff: RecommendationUniverseAlertDiff;
  mention?: string;
}) {
  const { diff, mention } = params;
  if (!diff.changes.length) {
    return [];
  }

  const categoryLabel = formatRecommendationUniverseCategory(diff.category);
  const headerParts = [
    mention?.trim(),
    `${categoryLabel} 유니버스 변화 알림`,
    `Generated ${nowInSeoul()} KST`,
    `changes=${diff.changes.length}, current=${diff.currentCount}, previous=${diff.previousCount}`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  return chunkMessages(buildRecommendationUniverseAlertLines(diff), header);
}

export async function sendDiscordMessages(params: {
  messages: string[];
  webhookUrl?: string;
  username?: string;
}) {
  const webhookUrl = params.webhookUrl ?? config.discordWebhookUrl;
  if (!webhookUrl) {
    throw new Error("Missing Discord webhook URL. Set DISCORD_WEBHOOK_URL or pass webhookUrl.");
  }

  for (const message of params.messages) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: message,
        username: params.username ?? "Stock Alert Bot"
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Discord webhook request failed with status ${response.status}${text ? `: ${text}` : ""}`);
    }
  }
}
