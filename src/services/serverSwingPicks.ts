import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServerSwingPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  category: "swing";
};

const serverSwingPicksPath = path.resolve(process.cwd(), "data", "server-swing-picks.json");

async function ensureDir() {
  await mkdir(path.dirname(serverSwingPicksPath), { recursive: true });
}

export async function readServerSwingPicks(): Promise<ServerSwingPick[]> {
  try {
    const raw = await readFile(serverSwingPicksPath, "utf8");
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

export async function writeServerSwingPicks(items: ServerSwingPick[]) {
  await ensureDir();
  await writeFile(serverSwingPicksPath, JSON.stringify(items, null, 2), "utf8");
  return items;
}

export { serverSwingPicksPath };
