import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PortfolioHolding } from "./types.js";
import { config } from "../../config.js";

export const portfolioHoldingsPath = path.resolve(process.cwd(), config.portfolioHoldingsPath);

async function ensureDir() {
  await mkdir(path.dirname(portfolioHoldingsPath), { recursive: true });
}

export function normalizeHoldingAmounts(holding: PortfolioHolding): PortfolioHolding {
  const investedAmount =
    typeof holding.investedAmount === "number" && Number.isFinite(holding.investedAmount)
      ? holding.investedAmount
      : holding.avgPrice * holding.quantity;
  const evaluationAmount =
    typeof holding.evaluationAmount === "number" && Number.isFinite(holding.evaluationAmount)
      ? holding.evaluationAmount
      : holding.currentPrice * holding.quantity;
  const profitRate =
    typeof holding.profitRate === "number" && Number.isFinite(holding.profitRate)
      ? holding.profitRate
      : investedAmount > 0
        ? ((evaluationAmount - investedAmount) / investedAmount) * 100
        : 0;

  return {
    ...holding,
    investedAmount,
    evaluationAmount,
    profitRate
  };
}

export async function readPortfolioHoldings(): Promise<PortfolioHolding[]> {
  try {
    const raw = await readFile(portfolioHoldingsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is PortfolioHolding => Boolean(item && typeof item === "object"))
          .map(normalizeHoldingAmounts)
      : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function writePortfolioHoldings(items: PortfolioHolding[]) {
  await ensureDir();
  const normalized = items.map(normalizeHoldingAmounts);
  await writeFile(portfolioHoldingsPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
