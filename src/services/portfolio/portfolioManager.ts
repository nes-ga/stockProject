import { getCurrentIsoDate, SEOUL_TIME_ZONE } from "../../lib/dates.js";
import { getRealtimeStockSnapshots } from "../realtimeStocks.js";
import { fetchQuoteAndChart } from "../stockAnalysis.js";
import { readPortfolioAccountSnapshot, writePortfolioAccountSnapshot } from "./accountStorage.js";
import { calculateHoldingEvaluationAmount, resolveHoldingInvestedAmount } from "./amounts.js";
import { getPortfolioDataSourceInfo } from "./dataSource.js";
import { linkPortfolioHistories } from "./historyLinker.js";
import { readPortfolioHoldings, writePortfolioHoldings } from "./holdingsStorage.js";
import { evaluatePortfolioHolding } from "./rules.js";
import { buildPortfolioTechnicalSetup, type PortfolioTechnicalSetup } from "./technicalSetup.js";
import type {
  PortfolioAccountSnapshot,
  PortfolioAccountSummary,
  PortfolioAdvice,
  PortfolioAdviceResponse,
  PortfolioHolding,
  PortfolioQuoteItem,
  PortfolioQuotesResponse
} from "./types.js";

const MAX_MARKET_QUOTE_AGE_DAYS = 4;
const MAX_ACCOUNT_SNAPSHOT_AGE_MS = 96 * 60 * 60 * 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundAmount(value: number) {
  return Math.round(value);
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function getHoldingInvestedAmount(holding: PortfolioHolding) {
  return resolveHoldingInvestedAmount(holding).amount;
}

function getHoldingEvaluationAmount(holding: PortfolioHolding) {
  return calculateHoldingEvaluationAmount(holding);
}

export function isPortfolioQuoteDateFresh(
  latestDate: string | undefined,
  today = getCurrentIsoDate(SEOUL_TIME_ZONE)
) {
  const latestIsoDate = latestDate?.slice(0, 10);
  if (!latestIsoDate || !/^\d{4}-\d{2}-\d{2}$/.test(latestIsoDate)) {
    return false;
  }

  const latestTime = Date.parse(`${latestIsoDate}T00:00:00Z`);
  const todayTime = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(latestTime) || !Number.isFinite(todayTime)) {
    return false;
  }

  const ageDays = (todayTime - latestTime) / (24 * 60 * 60 * 1000);
  return ageDays >= 0 && ageDays <= MAX_MARKET_QUOTE_AGE_DAYS;
}

export function isPortfolioAccountSnapshotFresh(
  account: PortfolioAccountSnapshot | undefined,
  now = Date.now()
) {
  const capturedAt = Date.parse(account?.capturedAt ?? "");
  if (!Number.isFinite(capturedAt)) {
    return false;
  }

  const ageMs = now - capturedAt;
  return ageMs >= -5 * 60 * 1000 && ageMs <= MAX_ACCOUNT_SNAPSHOT_AGE_MS;
}

export function isPortfolioAccountBudgetUsable(
  accountSummary: PortfolioAccountSummary,
  now = Date.now()
) {
  return (
    isPortfolioAccountSnapshotFresh(accountSummary.account, now) &&
    isFiniteNumber(accountSummary.buyingPower) &&
    accountSummary.buyingPower >= 0 &&
    isFiniteNumber(accountSummary.estimatedTotalAsset) &&
    accountSummary.estimatedTotalAsset > 0
  );
}

function buildAccountSummary(holdings: PortfolioHolding[], account?: PortfolioAccountSnapshot): PortfolioAccountSummary {
  const totalInvestedAmount = roundAmount(holdings.reduce((sum, holding) => sum + getHoldingInvestedAmount(holding), 0));
  const totalEvaluationAmount = roundAmount(holdings.reduce((sum, holding) => sum + getHoldingEvaluationAmount(holding), 0));
  const totalQuantity = roundAmount(holdings.reduce((sum, holding) => sum + holding.quantity, 0));
  const totalProfitAmount = roundAmount(totalEvaluationAmount - totalInvestedAmount);
  const totalProfitRate = totalInvestedAmount > 0 ? roundPercent((totalProfitAmount / totalInvestedAmount) * 100) : 0;
  const cashBalance = isFiniteNumber(account?.cashBalance) ? account.cashBalance : undefined;
  const buyingPower = isFiniteNumber(account?.buyingPower) ? account.buyingPower : cashBalance;
  const estimatedTotalAsset = isFiniteNumber(cashBalance) ? roundAmount(totalEvaluationAmount + cashBalance) : undefined;
  const stockWeightPercent =
    isFiniteNumber(estimatedTotalAsset) && estimatedTotalAsset > 0 ? roundPercent((totalEvaluationAmount / estimatedTotalAsset) * 100) : undefined;
  const cashWeightPercent =
    isFiniteNumber(estimatedTotalAsset) && estimatedTotalAsset > 0 && isFiniteNumber(cashBalance)
      ? roundPercent((cashBalance / estimatedTotalAsset) * 100)
      : undefined;

  return {
    total: holdings.length,
    totalQuantity,
    totalInvestedAmount,
    totalEvaluationAmount,
    totalProfitAmount,
    totalProfitRate,
    cashBalance,
    buyingPower,
    estimatedTotalAsset,
    stockWeightPercent,
    cashWeightPercent,
    account
  };
}

function buildAdviceSummary(
  items: PortfolioAdvice[],
  accountSummary: PortfolioAccountSummary
): PortfolioAdviceResponse["summary"] {
  return {
    total: items.length,
    highPriority: items.filter((item) => item.priorityLabel === "HIGH").length,
    addAllowed: items.filter((item) => item.aiAction === "ADD_ALLOWED").length,
    addWait: items.filter((item) => item.aiAction === "ADD_WAIT").length,
    rotationBuy: items.filter((item) => item.aiAction === "ROTATION_BUY").length,
    reduceOnRebound: items.filter((item) => item.aiAction === "REDUCE_ON_REBOUND").length,
    deadMoney: items.filter((item) => item.currentMode === "DEAD_MONEY").length,
    suggestedRecoveryBudget: roundAmount(
      items.reduce(
        (sum, item) =>
          sum +
          (item.recoveryPlan?.status === "RECOVERY_READY"
            ? item.recoveryPlan.suggestedAdditionalBuyAmount ?? 0
            : 0),
        0
      )
    ),
    maxRecoveryBudget: roundAmount(
      items.reduce(
        (sum, item) =>
          sum +
          (item.recoveryPlan?.status === "RECOVERY_READY"
            ? item.recoveryPlan.maxAdditionalBuyAmount ?? 0
            : 0),
        0
      )
    ),
    account: accountSummary
  };
}

async function buildLivePortfolioSnapshot() {
  const [holdings, account] = await Promise.all([readPortfolioHoldings(), readPortfolioAccountSnapshot()]);
  const payload = await getRealtimeStockSnapshots(
    holdings.map((holding) => ({
      key: holding.id,
      name: holding.name,
      symbol: holding.symbol
    }))
  );
  const snapshotsById = new Map(payload.items.map((item) => [item.key ?? item.symbol, item]));
  const priceSourceById = new Map<string, "LIVE_QUOTE" | "STORED_FALLBACK">();

  const itemsWithoutWeights = holdings.map((holding): Omit<PortfolioQuoteItem, "stockWeightPercent" | "assetWeightPercent"> => {
    const snapshot = snapshotsById.get(holding.id) ?? snapshotsById.get(holding.symbol);
    const livePrice = snapshot?.latestClose;
    const hasFreshLiveQuote =
      isFiniteNumber(livePrice) &&
      livePrice > 0 &&
      isPortfolioQuoteDateFresh(snapshot?.latestDate);
    const currentPrice = hasFreshLiveQuote ? livePrice : holding.currentPrice;
    priceSourceById.set(holding.id, hasFreshLiveQuote ? "LIVE_QUOTE" : "STORED_FALLBACK");
    const quoteFreshnessError =
      isFiniteNumber(livePrice) && livePrice > 0 && !hasFreshLiveQuote
        ? snapshot?.latestDate
          ? `시세 기준일 ${snapshot.latestDate}이 최신 허용 범위를 벗어났습니다.`
          : "시세 기준일을 확인할 수 없습니다."
        : undefined;
    const investedAmount = roundAmount(getHoldingInvestedAmount(holding));
    const evaluationAmount = roundAmount(currentPrice * holding.quantity);
    const profitAmount = roundAmount(evaluationAmount - investedAmount);
    const profitRate = investedAmount > 0 ? roundPercent((profitAmount / investedAmount) * 100) : 0;

    return {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      avgPrice: holding.avgPrice,
      currentPrice,
      previousClose: snapshot?.previousClose,
      changeAmount: snapshot?.changeAmount,
      changePercent: snapshot?.changePercent,
      quantity: holding.quantity,
      investedAmount,
      evaluationAmount,
      profitAmount,
      profitRate,
      latestDate: snapshot?.latestDate,
      error: snapshot?.error ?? quoteFreshnessError
    };
  });

  const totalEvaluationAmount = itemsWithoutWeights.reduce((sum, item) => sum + item.evaluationAmount, 0);
  const cashBalance = isFiniteNumber(account?.cashBalance) ? account.cashBalance : undefined;
  const estimatedTotalAsset = isFiniteNumber(cashBalance) ? totalEvaluationAmount + cashBalance : undefined;
  const items: PortfolioQuoteItem[] = itemsWithoutWeights.map((item) => ({
    ...item,
    stockWeightPercent: totalEvaluationAmount > 0 ? roundPercent((item.evaluationAmount / totalEvaluationAmount) * 100) : 0,
    assetWeightPercent:
      isFiniteNumber(estimatedTotalAsset) && estimatedTotalAsset > 0 ? roundPercent((item.evaluationAmount / estimatedTotalAsset) * 100) : undefined
  }));

  const quoteHoldings = holdings.map((holding) => {
    const quote = items.find((item) => item.id === holding.id);
    return quote
      ? {
          ...holding,
          currentPrice: quote.currentPrice,
          evaluationAmount: quote.evaluationAmount,
          profitRate: quote.profitRate
        }
      : holding;
  });

  return {
    fetchedAt: payload.fetchedAt,
    account,
    holdings: quoteHoldings,
    summary: buildAccountSummary(quoteHoldings, account),
    quoteItems: items,
    priceSourceById
  };
}

function getRecoveryBudgetCap(
  holding: PortfolioHolding,
  accountSummary: PortfolioAccountSummary,
  eligibleCount: number
) {
  if (
    !isFiniteNumber(accountSummary.buyingPower) ||
    !isFiniteNumber(accountSummary.estimatedTotalAsset) ||
    accountSummary.estimatedTotalAsset <= 0
  ) {
    return undefined;
  }

  const buyingPowerCap =
    Math.max(0, accountSummary.buyingPower * 0.5) /
    Math.max(1, eligibleCount);
  const currentPositionExposure = Math.max(
    getHoldingInvestedAmount(holding),
    getHoldingEvaluationAmount(holding)
  );
  const positionExposureCap = Math.max(
    0,
    accountSummary.estimatedTotalAsset * 0.15 - currentPositionExposure
  );

  return Math.min(buyingPowerCap, positionExposureCap);
}

async function buildPortfolioAdvicePayload(
  holdings: PortfolioHolding[],
  accountSummary: PortfolioAccountSummary,
  priceSourceById: Map<string, "LIVE_QUOTE" | "STORED_FALLBACK">
): Promise<PortfolioAdviceResponse> {
  const links = await linkPortfolioHistories(holdings);
  const technicalSetups = new Map<string, PortfolioTechnicalSetup>();
  await Promise.all(
    holdings
      .filter((holding) => holding.originalIntent === "LONG_TERM")
      .map(async (holding) => {
        try {
          const { points } = await fetchQuoteAndChart(holding.symbol, { range: "6mo", naverCount: 140 });
          technicalSetups.set(holding.id, buildPortfolioTechnicalSetup(points));
        } catch {
          technicalSetups.set(holding.id, buildPortfolioTechnicalSetup([]));
        }
      })
  );
  const evaluate = (
    holding: PortfolioHolding,
    maxAdditionalBuyAmount?: number,
    budgetAvailable = false
  ) => {
    const link = links.get(holding.id);
    return evaluatePortfolioHolding(holding, {
      swingCase: link?.swingCase,
      longTermPick: link?.longTermPick,
      linkedHistory: link?.linkedHistory,
      recoveryBudget: {
        priceSource: priceSourceById.get(holding.id) ?? "STORED_FALLBACK",
        maxAdditionalBuyAmount,
        budgetAvailable
      },
      technicalSetup: technicalSetups.get(holding.id)
    });
  };

  const initialItems = holdings.map((holding) => evaluate(holding));
  const eligibleCount = Math.max(
    1,
    initialItems.filter((item) => {
      const plan = item.recoveryPlan;
      return (
        (item.aiAction === "ADD_ALLOWED" || item.aiAction === "ROTATION_BUY") &&
        plan?.priceSource === "LIVE_QUOTE" &&
        Number(plan.currentLossAmount) > 0 &&
        Number(plan.requiredReboundRate) >= 1 &&
        (!Number.isFinite(plan.invalidPrice) || plan.calculatedAtPrice > Number(plan.invalidPrice))
      );
    }).length
  );
  const accountBudgetAvailable = isPortfolioAccountBudgetUsable(accountSummary);
  const items = holdings
    .map((holding) =>
      evaluate(
        holding,
        accountBudgetAvailable
          ? getRecoveryBudgetCap(holding, accountSummary, eligibleCount)
          : undefined,
        accountBudgetAvailable
      )
    )
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        right.confidence - left.confidence ||
        left.name.localeCompare(right.name, "ko")
    );

  return {
    asOfDate: getCurrentIsoDate(SEOUL_TIME_ZONE),
    dataSource: getPortfolioDataSourceInfo(),
    summary: buildAdviceSummary(items, accountSummary),
    items
  };
}

export async function getPortfolioAdvice(): Promise<PortfolioAdviceResponse> {
  const snapshot = await buildLivePortfolioSnapshot();
  return buildPortfolioAdvicePayload(snapshot.holdings, snapshot.summary, snapshot.priceSourceById);
}

export async function getPortfolioQuotes(): Promise<PortfolioQuotesResponse> {
  const snapshot = await buildLivePortfolioSnapshot();
  const advice = await buildPortfolioAdvicePayload(
    snapshot.holdings,
    snapshot.summary,
    snapshot.priceSourceById
  );

  return {
    fetchedAt: snapshot.fetchedAt,
    summary: snapshot.summary,
    items: snapshot.quoteItems,
    advice
  };
}

export async function getPortfolioHoldings() {
  return readPortfolioHoldings();
}

export function getPortfolioDataSource() {
  return getPortfolioDataSourceInfo();
}

export async function savePortfolioHoldings(items: PortfolioHolding[]) {
  return writePortfolioHoldings(items);
}

export async function savePortfolioAccount(input: Partial<PortfolioAccountSnapshot>) {
  return writePortfolioAccountSnapshot(input);
}

export async function upsertPortfolioHolding(item: PortfolioHolding) {
  const holdings = await readPortfolioHoldings();
  const index = holdings.findIndex((holding) => holding.id === item.id || holding.symbol === item.symbol);
  const next = [...holdings];
  if (index >= 0) {
    next[index] = item;
  } else {
    next.push(item);
  }
  return writePortfolioHoldings(next);
}

export async function deletePortfolioHolding(idOrSymbol: string) {
  const holdings = await readPortfolioHoldings();
  const next = holdings.filter((holding) => holding.id !== idOrSymbol && holding.symbol !== idOrSymbol);
  await writePortfolioHoldings(next);
  return {
    deleted: next.length !== holdings.length,
    items: next
  };
}
