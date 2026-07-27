import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { portfolioDataSource } from "./dataSource.js";
import type { PortfolioAccountSnapshot } from "./types.js";

export const portfolioAccountPath = portfolioDataSource.accountPath;

async function ensureDir() {
  await mkdir(path.dirname(portfolioAccountPath), { recursive: true });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizePortfolioAccountSnapshot(
  input: Partial<PortfolioAccountSnapshot>,
  missingCapturedAt = new Date().toISOString()
): PortfolioAccountSnapshot {
  const snapshot: PortfolioAccountSnapshot = {
    capturedAt: input.capturedAt ?? missingCapturedAt,
    source: input.source ?? "manual"
  };

  if (typeof input.brokerName === "string" && input.brokerName.trim()) {
    snapshot.brokerName = input.brokerName.trim();
  }
  if (typeof input.accountLabel === "string" && input.accountLabel.trim()) {
    snapshot.accountLabel = input.accountLabel.trim();
  }
  if (isFiniteNumber(input.cashBalance)) {
    snapshot.cashBalance = input.cashBalance;
  }
  if (isFiniteNumber(input.buyingPower)) {
    snapshot.buyingPower = input.buyingPower;
  }
  if (isFiniteNumber(input.totalInvestedAmount)) {
    snapshot.totalInvestedAmount = input.totalInvestedAmount;
  }
  if (isFiniteNumber(input.totalEvaluationAmount)) {
    snapshot.totalEvaluationAmount = input.totalEvaluationAmount;
  }
  if (isFiniteNumber(input.totalProfitAmount)) {
    snapshot.totalProfitAmount = input.totalProfitAmount;
  }
  if (isFiniteNumber(input.totalProfitRate)) {
    snapshot.totalProfitRate = input.totalProfitRate;
  }

  return snapshot;
}

export async function readPortfolioAccountSnapshot(): Promise<PortfolioAccountSnapshot | undefined> {
  try {
    const raw = await readFile(portfolioAccountPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? normalizePortfolioAccountSnapshot(parsed, new Date(0).toISOString())
      : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

export async function writePortfolioAccountSnapshot(input: Partial<PortfolioAccountSnapshot>) {
  await ensureDir();
  const snapshot = normalizePortfolioAccountSnapshot(input);
  await writeFile(portfolioAccountPath, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}
