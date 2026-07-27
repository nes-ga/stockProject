import { readFile } from "node:fs/promises";
import path from "node:path";
import { withJsonFileMutation, writeJsonFileAtomic } from "../lib/jsonFile.js";

export type ServerLongTermPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  bucketEnteredDate?: string;
  note?: string;
  category: "longTerm";
  longTermBucket?: "buy" | "accumulate" | "watch";
  source?: string;
};

const serverLongTermPicksPath = path.resolve(process.cwd(), "data", "server-long-term-picks.json");

type ServerLongTermPicksStorageOptions = {
  filePath?: string;
};

export async function readServerLongTermPicks(
  options?: ServerLongTermPicksStorageOptions
): Promise<ServerLongTermPick[]> {
  const filePath = options?.filePath ?? serverLongTermPicksPath;
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is ServerLongTermPick => Boolean(item && typeof item === "object"))
      : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function writeServerLongTermPicks(
  items: ServerLongTermPick[],
  options?: ServerLongTermPicksStorageOptions
) {
  const committed = await withServerLongTermPicksMutation(async () => ({
    nextItems: items,
    result: items
  }), options);
  return committed.items;
}

export async function withServerLongTermPicksMutation<T>(
  mutation: (
    previousItems: ServerLongTermPick[]
  ) =>
    | {
        nextItems: ServerLongTermPick[];
        result: T;
      }
    | Promise<{
        nextItems: ServerLongTermPick[];
        result: T;
      }>,
  options?: ServerLongTermPicksStorageOptions
) {
  const filePath = options?.filePath ?? serverLongTermPicksPath;
  return withJsonFileMutation(filePath, async () => {
    const previousItems = await readServerLongTermPicks({ filePath });
    const outcome = await mutation(previousItems);
    await writeJsonFileAtomic(filePath, outcome.nextItems);
    return {
      items: outcome.nextItems,
      result: outcome.result
    };
  });
}

export { serverLongTermPicksPath };
