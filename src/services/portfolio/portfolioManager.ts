import { getCurrentIsoDate, SEOUL_TIME_ZONE } from "../../lib/dates.js";
import { getRealtimeStockSnapshots } from "../realtimeStocks.js";
import { readPortfolioAccountSnapshot, writePortfolioAccountSnapshot } from "./accountStorage.js";
import { linkPortfolioHistories } from "./historyLinker.js";
import { readPortfolioHoldings, writePortfolioHoldings } from "./holdingsStorage.js";
import { evaluatePortfolioHolding } from "./rules.js";
import type {
  PortfolioAccountSnapshot,
  PortfolioAccountSummary,
  PortfolioAdvice,
  PortfolioAdviceResponse,
  PortfolioHolding,
  PortfolioQuoteItem,
  PortfolioQuotesResponse
} from "./types.js";

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
  return isFiniteNumber(holding.investedAmount) ? holding.investedAmount : holding.avgPrice * holding.quantity;
}

function getHoldingEvaluationAmount(holding: PortfolioHolding) {
  return isFiniteNumber(holding.evaluationAmount) ? holding.evaluationAmount : holding.currentPrice * holding.quantity;
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
    account: accountSummary
  };
}

export async function getPortfolioAdvice(): Promise<PortfolioAdviceResponse> {
  const holdings = await readPortfolioHoldings();
  const account = await readPortfolioAccountSnapshot();
  const links = await linkPortfolioHistories(holdings);
  const items = holdings
    .map((holding) => {
      const link = links.get(holding.id);
      return evaluatePortfolioHolding(holding, {
        swingCase: link?.swingCase,
        longTermPick: link?.longTermPick,
        linkedHistory: link?.linkedHistory
      });
    })
    .sort((left, right) => right.priority - left.priority || right.confidence - left.confidence || left.name.localeCompare(right.name, "ko"));

  return {
    asOfDate: getCurrentIsoDate(SEOUL_TIME_ZONE),
    summary: buildAdviceSummary(items, buildAccountSummary(holdings, account)),
    items
  };
}

export async function getPortfolioQuotes(): Promise<PortfolioQuotesResponse> {
  const holdings = await readPortfolioHoldings();
  const account = await readPortfolioAccountSnapshot();
  const payload = await getRealtimeStockSnapshots(
    holdings.map((holding) => ({
      key: holding.id,
      name: holding.name,
      symbol: holding.symbol
    }))
  );
  const snapshotsById = new Map(payload.items.map((item) => [item.key ?? item.symbol, item]));

  const itemsWithoutWeights = holdings.map((holding): Omit<PortfolioQuoteItem, "stockWeightPercent" | "assetWeightPercent"> => {
    const snapshot = snapshotsById.get(holding.id) ?? snapshotsById.get(holding.symbol);
    const currentPrice = isFiniteNumber(snapshot?.latestClose) ? snapshot.latestClose : holding.currentPrice;
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
      error: snapshot?.error
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
    summary: buildAccountSummary(quoteHoldings, account),
    items
  };
}

export async function getPortfolioHoldings() {
  return readPortfolioHoldings();
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
