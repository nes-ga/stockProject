import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const mutationQueues = new Map<string, Promise<void>>();
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_STALE_LOCK_MS = 5 * 60_000;
const LOCK_RETRY_MS = 25;

function isNodeErrorWithCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

async function removeFileIfPresent(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      throw error;
    }
  }
}

async function removeLockIfContentsMatch(lockPath: string, expectedContents: string) {
  try {
    const currentContents = await readFile(lockPath, "utf8");
    if (currentContents !== expectedContents) {
      return false;
    }
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function readLockOwnerPid(contents: string) {
  try {
    const value = JSON.parse(contents) as { pid?: unknown };
    return typeof value.pid === "number" && Number.isInteger(value.pid) && value.pid > 0
      ? value.pid
      : undefined;
  } catch {
    return undefined;
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNodeErrorWithCode(error, "ESRCH");
  }
}

async function acquireFileLock(
  filePath: string,
  options?: {
    timeoutMs?: number;
    staleLockMs?: number;
  }
) {
  const lockPath = `${filePath}.lock`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const staleLockMs = options?.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const deadline = Date.now() + timeoutMs;

  await mkdir(path.dirname(filePath), { recursive: true });

  while (true) {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    const lockContents = JSON.stringify({
      token: randomUUID(),
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    });
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(lockContents, "utf8");
      await handle.sync();
      const heartbeat = setInterval(() => {
        void handle?.utimes(new Date(), new Date()).catch(() => undefined);
      }, Math.max(1_000, Math.floor(staleLockMs / 3)));
      heartbeat.unref();

      return async () => {
        clearInterval(heartbeat);
        try {
          await handle?.close();
        } finally {
          await removeLockIfContentsMatch(lockPath, lockContents);
        }
      };
    } catch (error) {
      if (handle) {
        try {
          await handle.close();
        } finally {
          await removeLockIfContentsMatch(lockPath, lockContents);
        }
      }

      if (!isNodeErrorWithCode(error, "EEXIST")) {
        throw error;
      }

      try {
        const lockStats = await stat(lockPath);
        if (Date.now() - lockStats.mtimeMs > staleLockMs) {
          const staleContents = await readFile(lockPath, "utf8");
          const ownerPid = readLockOwnerPid(staleContents);
          const confirmedStats = await stat(lockPath);
          const stillStale =
            confirmedStats.mtimeMs === lockStats.mtimeMs &&
            Date.now() - confirmedStats.mtimeMs > staleLockMs;
          if (
            stillStale &&
            (ownerPid === undefined || !isProcessAlive(ownerPid)) &&
            (await removeLockIfContentsMatch(lockPath, staleContents))
          ) {
            continue;
          }
        }
      } catch (statError) {
        if (isNodeErrorWithCode(statError, "ENOENT")) {
          continue;
        }
        throw statError;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for JSON file lock: ${filePath}`);
      }

      await delay(LOCK_RETRY_MS);
    }
  }
}

function enqueueFileMutation<T>(filePath: string, operation: () => Promise<T>) {
  const queueKey = path.resolve(filePath);
  const previous = mutationQueues.get(queueKey) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined
  );

  mutationQueues.set(queueKey, tail);
  void tail.then(() => {
    if (mutationQueues.get(queueKey) === tail) {
      mutationQueues.delete(queueKey);
    }
  });

  return result;
}

export function withJsonFileMutation<T>(
  filePath: string,
  operation: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    staleLockMs?: number;
  }
) {
  return enqueueFileMutation(filePath, async () => {
    const release = await acquireFileLock(filePath, options);
    try {
      return await operation();
    } finally {
      await release();
    }
  });
}

export async function writeJsonFileAtomic(filePath: string, payload: unknown) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  JSON.parse(serialized);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, serialized, {
      encoding: "utf8",
      flag: "wx"
    });
    JSON.parse(await readFile(temporaryPath, "utf8"));
    await rename(temporaryPath, filePath);
  } catch (error) {
    await removeFileIfPresent(temporaryPath);
    throw error;
  }
}
