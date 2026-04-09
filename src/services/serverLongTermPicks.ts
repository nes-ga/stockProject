import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServerLongTermPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  category: "longTerm";
};

const serverLongTermPicksPath = path.resolve(process.cwd(), "data", "server-long-term-picks.json");

async function ensureDir() {
  await mkdir(path.dirname(serverLongTermPicksPath), { recursive: true });
}

export async function readServerLongTermPicks(): Promise<ServerLongTermPick[]> {
  try {
    const raw = await readFile(serverLongTermPicksPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function writeServerLongTermPicks(items: ServerLongTermPick[]) {
  await ensureDir();
  await writeFile(serverLongTermPicksPath, JSON.stringify(items, null, 2), "utf8");
  return items;
}

export { serverLongTermPicksPath };
