import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type DiscordAlertHistoryAlertType =
  | "recommendation-pattern"
  | "smart-money-pattern"
  | "recommendation-universe"
  | "korean-movers"
  | "price-spike"
  | "smart-money-watchlist";

export type DiscordAlertHistoryRecordInput = {
  alertType: DiscordAlertHistoryAlertType;
  source: string;
  username?: string;
  messageCount?: number;
  messageIndex?: number;
  category?: string;
  profile?: string;
  symbol?: string;
  name?: string;
  bucket?: string;
  previousBucket?: string;
  changeType?: string;
  anchorDate?: string;
  latestMentionDate?: string;
  referenceDate?: string;
  metadata?: Record<string, unknown>;
};

export type DiscordAlertHistoryRecord = DiscordAlertHistoryRecordInput & {
  schemaVersion: 1;
  id: string;
  channel: "discord";
  sentAt: string;
  sentDate: string;
};

export const discordAlertHistoryPath = path.resolve(process.cwd(), "data", "discord-alert-history.jsonl");

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function normalizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return undefined;
  }
  return compactObject(metadata);
}

function buildRecordId(record: DiscordAlertHistoryRecordInput, sentAt: string, index: number) {
  const parts = [
    sentAt,
    record.alertType,
    record.source,
    record.category,
    record.profile,
    record.symbol,
    record.changeType,
    String(index + 1)
  ].filter(Boolean);

  return parts.join(":").replace(/[^a-zA-Z0-9:_-]/g, "_");
}

export async function appendDiscordAlertHistoryRecords(records: DiscordAlertHistoryRecordInput[]) {
  if (!records.length) {
    return {
      path: discordAlertHistoryPath,
      appended: 0
    };
  }

  const sentAt = new Date().toISOString();
  const sentDate = sentAt.slice(0, 10);
  const normalizedRecords: DiscordAlertHistoryRecord[] = records.map((record, index) =>
    compactObject({
      ...record,
      schemaVersion: 1,
      id: buildRecordId(record, sentAt, index),
      channel: "discord",
      sentAt,
      sentDate,
      metadata: normalizeMetadata(record.metadata)
    })
  );

  await mkdir(path.dirname(discordAlertHistoryPath), { recursive: true });
  await appendFile(discordAlertHistoryPath, `${normalizedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");

  return {
    path: discordAlertHistoryPath,
    appended: normalizedRecords.length
  };
}
