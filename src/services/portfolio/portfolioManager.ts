import { getCurrentIsoDate, SEOUL_TIME_ZONE } from "../../lib/dates.js";
import { linkPortfolioHistories } from "./historyLinker.js";
import { readPortfolioHoldings, writePortfolioHoldings } from "./holdingsStorage.js";
import { evaluatePortfolioHolding } from "./rules.js";
import type { PortfolioAdvice, PortfolioAdviceResponse, PortfolioHolding } from "./types.js";

function buildAdviceSummary(items: PortfolioAdvice[]): PortfolioAdviceResponse["summary"] {
  return {
    total: items.length,
    highPriority: items.filter((item) => item.priorityLabel === "HIGH").length,
    addAllowed: items.filter((item) => item.aiAction === "ADD_ALLOWED").length,
    addWait: items.filter((item) => item.aiAction === "ADD_WAIT").length,
    rotationBuy: items.filter((item) => item.aiAction === "ROTATION_BUY").length,
    reduceOnRebound: items.filter((item) => item.aiAction === "REDUCE_ON_REBOUND").length,
    deadMoney: items.filter((item) => item.currentMode === "DEAD_MONEY").length
  };
}

export async function getPortfolioAdvice(): Promise<PortfolioAdviceResponse> {
  const holdings = await readPortfolioHoldings();
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
    summary: buildAdviceSummary(items),
    items
  };
}

export async function getPortfolioHoldings() {
  return readPortfolioHoldings();
}

export async function savePortfolioHoldings(items: PortfolioHolding[]) {
  return writePortfolioHoldings(items);
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
