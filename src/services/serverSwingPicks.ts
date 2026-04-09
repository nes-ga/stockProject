import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServerSwingPick = {
  key: string;
  name: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  bucket?: ServerSwingPickBucket;
  category: "swing";
};

export type ServerSwingPickBucket = "execution" | "watch";

export type ServerSwingPickPayload = {
  executionItems: ServerSwingPick[];
  watchItems: ServerSwingPick[];
  items: ServerSwingPick[];
};

const serverSwingPicksPath = path.resolve(process.cwd(), "data", "server-swing-picks.json");

async function ensureDir() {
  await mkdir(path.dirname(serverSwingPicksPath), { recursive: true });
}

function normalizeServerSwingPick(item: unknown, fallbackBucket: ServerSwingPickBucket): ServerSwingPick | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Partial<ServerSwingPick>;
  if (
    typeof candidate.key !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.symbol !== "string" ||
    typeof candidate.anchorDate !== "string"
  ) {
    return null;
  }

  return {
    key: candidate.key,
    name: candidate.name,
    symbol: candidate.symbol,
    anchorDate: candidate.anchorDate,
    latestMentionDate: typeof candidate.latestMentionDate === "string" ? candidate.latestMentionDate : undefined,
    note: typeof candidate.note === "string" ? candidate.note : undefined,
    bucket: candidate.bucket === "watch" ? "watch" : candidate.bucket === "execution" ? "execution" : fallbackBucket,
    category: "swing"
  };
}

function buildServerSwingPickPayload(raw: unknown): ServerSwingPickPayload {
  if (Array.isArray(raw)) {
    const executionItems = raw
      .map((item) => normalizeServerSwingPick(item, "execution"))
      .filter((item): item is ServerSwingPick => Boolean(item));
    return {
      executionItems,
      watchItems: [],
      items: executionItems
    };
  }

  if (!raw || typeof raw !== "object") {
    return {
      executionItems: [],
      watchItems: [],
      items: []
    };
  }

  const parsed = raw as {
    executionItems?: unknown[];
    watchItems?: unknown[];
    items?: unknown[];
  };
  const legacyItems = Array.isArray(parsed.items) ? parsed.items : [];
  const executionSource = Array.isArray(parsed.executionItems) ? parsed.executionItems : legacyItems;
  const watchSource = Array.isArray(parsed.watchItems) ? parsed.watchItems : [];
  const executionItems = executionSource
    .map((item) => normalizeServerSwingPick(item, "execution"))
    .filter((item): item is ServerSwingPick => Boolean(item));
  const watchItems = watchSource
    .map((item) => normalizeServerSwingPick(item, "watch"))
    .filter((item): item is ServerSwingPick => Boolean(item));
  const merged = new Map<string, ServerSwingPick>();

  for (const item of executionItems) {
    merged.set(item.key, item);
  }

  for (const item of watchItems) {
    if (!merged.has(item.key)) {
      merged.set(item.key, item);
    }
  }

  return {
    executionItems,
    watchItems,
    items: [...merged.values()]
  };
}

export async function readServerSwingPickPayload(): Promise<ServerSwingPickPayload> {
  try {
    const raw = await readFile(serverSwingPicksPath, "utf8");
    const parsed = JSON.parse(raw);
    return buildServerSwingPickPayload(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) {
      return {
        executionItems: [],
        watchItems: [],
        items: []
      };
    }
    throw error;
  }
}

export async function readServerSwingPicks(): Promise<ServerSwingPick[]> {
  const payload = await readServerSwingPickPayload();
  return payload.items;
}

export async function writeServerSwingPicks(
  input:
    | ServerSwingPick[]
    | {
        executionItems?: ServerSwingPick[];
        watchItems?: ServerSwingPick[];
        items?: ServerSwingPick[];
      }
) {
  const payload = buildServerSwingPickPayload(input);
  await ensureDir();
  await writeFile(
    serverSwingPicksPath,
    JSON.stringify(
      {
        executionItems: payload.executionItems,
        watchItems: payload.watchItems
      },
      null,
      2
    ),
    "utf8"
  );
  return payload;
}

export { serverSwingPicksPath };
