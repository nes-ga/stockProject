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
    return "\uD3ED\uBC1C";
  }
  if (signal === "strong") {
    return "\uAC15\uD568";
  }
  return "\uAD00\uCC30";
}

function buildAlertLines(analyses: KoreanMoverAnalysis[]) {
  return analyses.map((item, index) => {
    const parts = [
      `${index + 1}. [${item.market}] ${item.name}(${item.symbol})`,
      `\uB4F1\uB77D\uB960 ${formatNumber(item.changePercent)}%`,
      `\uC810\uC218 ${item.alertScore}`,
      `\uC2E0\uD638 ${formatSignal(item.signal)}`
    ];

    if (item.volumeRatio20d != null) {
      parts.push(`\uAC70\uB798\uB7C9 ${formatNumber(item.volumeRatio20d)}\uBC30`);
    }

    if (item.estimatedTurnover != null) {
      parts.push(`\uAC70\uB798\uB300\uAE08 ${formatNumber(item.estimatedTurnover / 100_000_000, 0)}\uC5B5`);
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
    "\uAD6D\uB0B4 \uAE09\uB4F1\uC8FC \uC54C\uB9BC",
    `\uAE30\uC900 ${nowInSeoul()} KST`,
    `(direction=${filters.direction}, market=${filters.market}, minChange=${filters.minChangePercent}, minVol=${filters.minVolumeRatio}, minScore=${filters.minAlertScore})`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  if (!analyses.length) {
    return [`${header}\n\uC870\uAC74\uC744 \uB9CC\uC871\uD55C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`];
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
      return "\uAE30\uC900\uBD09 \uD615\uC131";
    case "pullback_early":
      return "\uB20C\uB9BC \uCD08\uAE30";
    case "pullback_ready":
      return "\uB20C\uB9BC \uC644\uC131";
    case "buy_ready":
      return "1\uCC28 \uB9E4\uC218 \uAC00\uB2A5";
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

function formatEntryStrategy(entryStrategy?: SmartMoneyPatternAnalysis["pattern"]["entryStrategy"]): string {
  switch (entryStrategy) {
    case "pullback_buy":
      return "\uB20C\uB9BC\uB9E4\uC218";
    case "breakout_ready":
      return "\uB3CC\uD30C\uB300\uAE30";
    case "breakout_confirmed":
      return "\uB3CC\uD30C\uD655\uC778";
    case "no_chase":
      return "\uCD94\uACA9\uAE08\uC9C0";
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
      `display ${formatSwingStatus(pattern.status)}`,
      `strategy ${formatEntryStrategy(pattern.entryStrategy)}`,
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
    `lookbacks=${filters.lookbackWindows.join("/")}, leadVol=${filters.minLeadInVolumeRatio}/${Math.round(filters.minLeadInVolumeShares).toLocaleString("ko-KR")}\uC8FC, breakoutVol=${filters.minBreakoutVolumeRatio}/${Math.round(filters.minBreakoutVolumeShares).toLocaleString("ko-KR")}\uC8FC, minTurnover=${Math.round(filters.minTurnoverValue).toLocaleString("ko-KR")}, recent=${filters.recentSignalSessions}`
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

function isSwingUniverseCategory(category: RecommendationUniverseAlertCategory) {
  return category === "swing" || category === "smallcapSwing";
}

function formatRecommendationUniverseCategory(category: RecommendationUniverseAlertCategory) {
  if (category === "smallcapSwing") {
    return "\uC18C\uD615 \uC2A4\uC719";
  }

  if (category === "swing") {
    return "\uC2A4\uC719";
  }

  if (category === "dividend") {
    return "\uBC30\uB2F9";
  }

  return "\uC911\uC7A5\uAE30";
}

function formatRecommendationUniverseBucket(
  category: RecommendationUniverseAlertCategory,
  bucket?: RecommendationUniverseAlertBucket
) {
  if (!bucket) {
    return "-";
  }

  if (isSwingUniverseCategory(category)) {
    return bucket === "execution" ? "\uB9E4\uC218\uD6C4\uBCF4" : "\uAD00\uC2EC\uD6C4\uBCF4";
  }

  return bucket === "buy" ? "\uB9E4\uC218\uD6C4\uBCF4\uAD70" : "\uAD00\uCC30\uAD70";
}

function buildRecommendationUniverseAlertLines(diff: RecommendationUniverseAlertDiff) {
  return diff.changes.map((change, index) => {
    const prefix = `${index + 1}. ${change.name} (${change.symbol})`;

    if (change.type === "added") {
      return `${prefix} | \uC2E0\uADDC \uD3B8\uC785 | ${formatRecommendationUniverseBucket(diff.category, change.toBucket)}`;
    }

    if (change.type === "removed") {
      return `${prefix} | \uC81C\uC678 | ${formatRecommendationUniverseBucket(diff.category, change.fromBucket)}`;
    }

    return `${prefix} | \uC774\uB3D9 | ${formatRecommendationUniverseBucket(diff.category, change.fromBucket)} -> ${formatRecommendationUniverseBucket(diff.category, change.toBucket)}`;
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
    `${categoryLabel} \uC720\uB2C8\uBC84\uC2A4 \uBCC0\uD654 \uC54C\uB9BC`,
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
