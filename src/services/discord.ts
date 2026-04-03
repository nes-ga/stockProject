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
    const parts = [
      `${index + 1}. ${item.name ?? item.symbol} (${item.symbol})`,
      `ref ${item.tradingReferenceDate}`,
      `lead ${pattern.leadInDate ?? "-"}`,
      `breakout ${pattern.breakoutDate ?? "-"}`,
      `score ${pattern.patternScore}`,
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
    `lookback=${filters.lookbackTradingDays}, leadVol=${filters.minLeadInVolumeRatio}, breakoutVol=${filters.minBreakoutVolumeRatio}, setupScore=${filters.minSetupPatternScore}, breakoutScore=${filters.minBreakoutPatternScore}, recent=${filters.recentSignalSessions}`
  ].filter(Boolean);
  const header = headerParts.join("\n");

  if (!analyses.length) {
    return [`${header}\nNo symbols matched the smart-money entry pattern.`];
  }

  return chunkMessages(buildSmartMoneyPatternLines(analyses), header);
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
