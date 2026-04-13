import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServerDividendPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  latestDividendDate?: string;
  latestDividendAmount?: number;
  note?: string;
  category: "dividend";
  longTermBucket?: "buy" | "watch";
  source?: string;
};

const serverDividendPicksPath = path.resolve(process.cwd(), "data", "server-dividend-picks.json");

async function ensureDir() {
  await mkdir(path.dirname(serverDividendPicksPath), { recursive: true });
}

export async function readServerDividendPicks(): Promise<ServerDividendPick[]> {
  try {
    const raw = await readFile(serverDividendPicksPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is ServerDividendPick => Boolean(item && typeof item === "object"))
      : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function writeServerDividendPicks(items: ServerDividendPick[]) {
  await ensureDir();
  await writeFile(serverDividendPicksPath, JSON.stringify(items, null, 2), "utf8");
  return items;
}

export { serverDividendPicksPath };
