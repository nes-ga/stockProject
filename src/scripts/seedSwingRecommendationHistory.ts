import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchLongTermChart } from "../services/longTerm/marketData.js";

type SwingPick = {
  key?: string;
  name?: string;
  symbol?: string;
  anchorDate?: string;
  latestMentionDate?: string;
  note?: string;
  bucket?: string;
  tags?: string[];
  reasons?: string[];
  category?: string;
  swingProfile?: string;
  source?: string;
};

type SwingPickPayload = {
  executionItems?: SwingPick[];
  watchItems?: SwingPick[];
};

type ChartPoint = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

type SwingHistoryCase = {
  id: string;
  strategy: "swing";
  profile: "default" | "smallcap";
  symbol: string;
  name: string;
  sourceKey: string;
  openedAt: string;
  openedDate: string;
  dataDate: string;
  entryBucket: string;
  status: "active";
  assumption: {
    executionModel: "weighted_staged_buy";
    trigger: "daily_low_touched_buy_price";
    note: string;
  };
  buyPlan: {
    firstBuyPrice: number;
    secondBuyPrice: number;
    thirdBuyPrice: number;
    stopLossPrice: number;
  };
  executedBuyCount: number;
  executedBuys: Array<{
    stage: 1 | 2 | 3;
    price: number;
  }>;
  averageBuyPrice: number;
  latestClose: number;
  latestLow: number;
  rawLatestLow?: number;
  unrealizedReturnPct: number;
  initialSnapshot: {
    anchorDate?: string;
    latestMentionDate?: string;
    note?: string;
    tags: string[];
    reasons: string[];
    source?: string;
  };
};

type SwingHistoryPayload = {
  schemaVersion: 1;
  generatedAt: string;
  asOfDate: string;
  scope: {
    strategy: "swing";
    profiles: Array<"default" | "smallcap">;
    sourceFiles: string[];
    includedBuckets: string[];
    includeOnlyTouchedFirstBuy: boolean;
  };
  summary: {
    scannedExecutionCandidates: number;
    openedCases: number;
    defaultCases: number;
    smallcapCases: number;
    firstBuyOnlyCases: number;
    secondBuyReachedCases: number;
    thirdBuyReachedCases: number;
  };
  cases: SwingHistoryCase[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const today = process.env.HISTORY_DATE ?? formatDateInSeoul(new Date());
const SWING_MIN_REFERENCE_PRICE = 1000;

const sourceFiles = [
  { profile: "default" as const, file: "server-swing-picks.json" },
  { profile: "smallcap" as const, file: "server-smallcap-swing-picks.json" }
];

function formatDateInSeoul(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBuyPlan(note: string | undefined) {
  const source = note ?? "";
  const buyMatch = source.match(/매수\s+([\d,]+)\/([\d,]+)\/([\d,]+)/);
  const stopMatch = source.match(/손절\s+([\d,]+)/);
  const firstBuyPrice = parseNumber(buyMatch?.[1]);
  const secondBuyPrice = parseNumber(buyMatch?.[2]);
  const thirdBuyPrice = parseNumber(buyMatch?.[3]);
  const stopLossPrice = parseNumber(stopMatch?.[1]);

  if (
    firstBuyPrice == null ||
    secondBuyPrice == null ||
    thirdBuyPrice == null ||
    stopLossPrice == null
  ) {
    return undefined;
  }

  return {
    firstBuyPrice,
    secondBuyPrice,
    thirdBuyPrice,
    stopLossPrice
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getStagedBuyWeight(stage: number) {
  if (stage >= 3) {
    return 4;
  }
  if (stage === 2) {
    return 2;
  }
  return 1;
}

function weightedAverageExecutedBuys(executedBuys: Array<{ stage: 1 | 2 | 3; price: number }>) {
  const totalWeight = executedBuys.reduce((sum, buy) => sum + getStagedBuyWeight(buy.stage), 0);
  return executedBuys.reduce((sum, buy) => sum + buy.price * getStagedBuyWeight(buy.stage), 0) / totalWeight;
}

function resolveLatestPoint(points: ChartPoint[]) {
  const validPoints = points.filter((point) => point.date <= today && typeof point.close === "number");
  return validPoints.at(-1);
}

function resolveExecutedBuys(buyPlan: NonNullable<ReturnType<typeof parseBuyPlan>>, latestLow: number) {
  return [
    { stage: 1 as const, price: buyPlan.firstBuyPrice },
    { stage: 2 as const, price: buyPlan.secondBuyPrice },
    { stage: 3 as const, price: buyPlan.thirdBuyPrice }
  ].filter((buy) => latestLow <= buy.price);
}

async function readSwingPayload(file: string): Promise<SwingPickPayload> {
  const raw = await readFile(path.join(projectRoot, "data", file), "utf8");
  return JSON.parse(raw) as SwingPickPayload;
}

async function buildCase(profile: "default" | "smallcap", item: SwingPick): Promise<SwingHistoryCase | undefined> {
  if (!item.symbol || !item.name) {
    return undefined;
  }

  const buyPlan = parseBuyPlan(item.note);
  if (!buyPlan) {
    return undefined;
  }

  const points = await fetchLongTermChart(item.symbol, 10);
  const latestPoint = resolveLatestPoint(points);
  if (!latestPoint || typeof latestPoint.low !== "number" || typeof latestPoint.close !== "number") {
    return undefined;
  }

  const effectiveLow = latestPoint.low > 0 ? latestPoint.low : latestPoint.close;
  if (latestPoint.close <= SWING_MIN_REFERENCE_PRICE || buyPlan.firstBuyPrice <= SWING_MIN_REFERENCE_PRICE) {
    return undefined;
  }

  const executedBuys = resolveExecutedBuys(buyPlan, effectiveLow);
  if (!executedBuys.length) {
    return undefined;
  }

  const averageBuyPrice = weightedAverageExecutedBuys(executedBuys);

  return {
    id: `swing:${profile}:${item.symbol}:${today}`,
    strategy: "swing",
    profile,
    symbol: item.symbol,
    name: item.name,
    sourceKey: item.key ?? `${item.name}-${item.symbol}`,
    openedAt: new Date().toISOString(),
    openedDate: today,
    dataDate: latestPoint.date,
    entryBucket: item.bucket ?? "execution",
    status: "active",
    assumption: {
      executionModel: "weighted_staged_buy",
      trigger: "daily_low_touched_buy_price",
      note: "일봉 저가가 각 분할 매수가를 터치하면 1차:2차:3차 = 1:2:4 금액 비중으로 체결된 것으로 가정합니다."
    },
    buyPlan,
    executedBuyCount: executedBuys.length,
    executedBuys,
    averageBuyPrice: round(averageBuyPrice, 2),
    latestClose: latestPoint.close,
    latestLow: effectiveLow,
    rawLatestLow: latestPoint.low === effectiveLow ? undefined : latestPoint.low,
    unrealizedReturnPct: round(((latestPoint.close - averageBuyPrice) / averageBuyPrice) * 100, 2),
    initialSnapshot: {
      anchorDate: item.anchorDate,
      latestMentionDate: item.latestMentionDate,
      note: item.note,
      tags: item.tags ?? [],
      reasons: item.reasons ?? [],
      source: item.source
    }
  };
}

async function main() {
  const cases: SwingHistoryCase[] = [];
  let scannedExecutionCandidates = 0;

  for (const source of sourceFiles) {
    const payload = await readSwingPayload(source.file);
    const executionItems = payload.executionItems ?? [];
    scannedExecutionCandidates += executionItems.length;

    for (const item of executionItems) {
      const historyCase = await buildCase(source.profile, item);
      if (historyCase) {
        cases.push(historyCase);
      }
    }
  }

  const output: SwingHistoryPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    asOfDate: today,
    scope: {
      strategy: "swing",
      profiles: ["default", "smallcap"],
      sourceFiles: sourceFiles.map((source) => `data/${source.file}`),
      includedBuckets: ["executionItems"],
      includeOnlyTouchedFirstBuy: true
    },
    summary: {
      scannedExecutionCandidates,
      openedCases: cases.length,
      defaultCases: cases.filter((item) => item.profile === "default").length,
      smallcapCases: cases.filter((item) => item.profile === "smallcap").length,
      firstBuyOnlyCases: cases.filter((item) => item.executedBuyCount === 1).length,
      secondBuyReachedCases: cases.filter((item) => item.executedBuyCount >= 2).length,
      thirdBuyReachedCases: cases.filter((item) => item.executedBuyCount >= 3).length
    },
    cases: cases.sort((left, right) => {
      if (right.executedBuyCount !== left.executedBuyCount) {
        return right.executedBuyCount - left.executedBuyCount;
      }
      return left.name.localeCompare(right.name, "ko");
    })
  };

  const outputDir = path.join(projectRoot, "data", "recommendation-history");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "swing-history.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${output.cases.length} swing history cases for ${today} (${output.summary.secondBuyReachedCases} reached 2nd+, ${output.summary.thirdBuyReachedCases} reached 3rd).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

