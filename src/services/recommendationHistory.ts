import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const swingHistoryPath = path.join(projectRoot, "data", "recommendation-history", "swing-history.json");
const swingSourceFiles = [
  { profile: "default", file: "server-swing-picks.json" },
  { profile: "smallcap", file: "server-smallcap-swing-picks.json" }
] as const;

type SwingCandidate = {
  key?: string;
  name?: string;
  symbol?: string;
  anchorDate?: string;
  latestMentionDate?: string;
  bucket?: string;
  note?: string;
  category?: string;
  swingProfile?: string;
  source?: string;
  postEntryOutcome?: {
    status?: string;
    executedBuyCount?: number;
    averageBuyPrice?: number;
    maxFavorableReturnPct?: number;
    [key: string]: unknown;
  };
};

type SwingPickPayload = {
  executionItems?: SwingCandidate[];
  watchItems?: SwingCandidate[];
};

type SwingHistoryCase = {
  profile?: string;
  symbol?: string;
  status?: string;
  [key: string]: unknown;
};

type SwingHistoryPayload = {
  summary?: Record<string, unknown>;
  cases?: SwingHistoryCase[];
  [key: string]: unknown;
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function getCandidateKey(profile: string | undefined, symbol: string | undefined) {
  return `${profile ?? ""}:${symbol ?? ""}`;
}

function getExecutedBuyCount(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const count = (value as { executedBuyCount?: unknown }).executedBuyCount;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

async function readCurrentSwingCandidates() {
  const candidates: Array<SwingCandidate & { profile: "default" | "smallcap"; sourceBucket: "execution" | "watch" }> = [];

  for (const source of swingSourceFiles) {
    const payload = await readJsonFile<SwingPickPayload>(path.join(projectRoot, "data", source.file));
    const executionItems = payload.executionItems ?? [];
    const watchItems = payload.watchItems ?? [];

    candidates.push(
      ...executionItems.map((item) => ({
        ...item,
        profile: source.profile,
        sourceBucket: "execution" as const
      })),
      ...watchItems.map((item) => ({
        ...item,
        profile: source.profile,
        sourceBucket: "watch" as const
      }))
    );
  }

  return candidates.filter((item) => item.symbol);
}

export async function readSwingRecommendationHistory() {
  const payload = await readJsonFile<SwingHistoryPayload>(swingHistoryPath);
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  const currentCandidates = await readCurrentSwingCandidates();
  const currentByProfileSymbol = new Map(
    currentCandidates.map((candidate) => [getCandidateKey(candidate.profile, candidate.symbol), candidate])
  );
  const currentBySymbol = new Map(currentCandidates.map((candidate) => [candidate.symbol, candidate]));

  const enrichedCases = cases.map((historyCase) => {
    const currentRecommendation =
      currentByProfileSymbol.get(getCandidateKey(historyCase.profile, historyCase.symbol)) ??
      currentBySymbol.get(historyCase.symbol);
    const lifecycleStatus = currentRecommendation ? "current" : "closed";

    return {
      ...historyCase,
      lifecycleStatus,
      currentRecommendation: currentRecommendation
        ? {
            key: currentRecommendation.key,
            name: currentRecommendation.name,
            symbol: currentRecommendation.symbol,
            profile: currentRecommendation.profile,
            bucket: currentRecommendation.bucket ?? currentRecommendation.sourceBucket,
            sourceBucket: currentRecommendation.sourceBucket,
            anchorDate: currentRecommendation.anchorDate,
            latestMentionDate: currentRecommendation.latestMentionDate,
            source: currentRecommendation.source
          }
        : undefined
    };
  });

  const historyCaseByProfileSymbol = new Map(
    enrichedCases.map((historyCase) => [getCandidateKey(historyCase.profile as string | undefined, historyCase.symbol), historyCase])
  );
  const historyCaseBySymbol = new Map(enrichedCases.map((historyCase) => [historyCase.symbol, historyCase]));
  const enrichedCurrentCandidates = currentCandidates.map((candidate) => {
    const historyCase =
      historyCaseByProfileSymbol.get(getCandidateKey(candidate.profile, candidate.symbol)) ??
      historyCaseBySymbol.get(candidate.symbol);
    const liveExecutedBuyCount = getExecutedBuyCount(candidate.postEntryOutcome);
    const historyExecutedBuyCount = getExecutedBuyCount(historyCase);
    const hasEntryAssumption = historyExecutedBuyCount > 0 || liveExecutedBuyCount > 0;

    return {
      key: candidate.key,
      name: candidate.name,
      symbol: candidate.symbol,
      profile: candidate.profile,
      bucket: candidate.bucket ?? candidate.sourceBucket,
      sourceBucket: candidate.sourceBucket,
      anchorDate: candidate.anchorDate,
      latestMentionDate: candidate.latestMentionDate,
      source: candidate.source,
      hasHistoryCase: Boolean(historyCase),
      hasEntryAssumption,
      postEntryOutcome: candidate.postEntryOutcome,
      historyCase
    };
  });
  const enteredCurrentCandidates = enrichedCurrentCandidates.filter((candidate) => candidate.hasEntryAssumption);
  const pendingEntryCandidates = enrichedCurrentCandidates.filter((candidate) => !candidate.hasEntryAssumption);

  const currentCaseCount = enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "current").length;
  const closedCaseCount = enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "closed").length;

  return {
    ...payload,
    cases: enrichedCases,
    currentCandidates: enteredCurrentCandidates,
    pendingEntryCandidates,
    closedCases: enrichedCases.filter((historyCase) => historyCase.lifecycleStatus === "closed"),
    summary: {
      ...(payload.summary ?? {}),
      currentRecommendationCount: currentCandidates.length,
      currentEnteredRecommendationCount: enteredCurrentCandidates.length,
      pendingEntryCandidateCount: pendingEntryCandidates.length,
      currentExecutionCount: currentCandidates.filter((candidate) => candidate.sourceBucket === "execution").length,
      currentWatchCount: currentCandidates.filter((candidate) => candidate.sourceBucket === "watch").length,
      currentCaseCount,
      closedCaseCount
    }
  };
}
