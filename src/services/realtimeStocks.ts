import type { RealtimeStockDetail, RealtimeStockRequest, RealtimeStockSnapshot } from "../types.js";
import { loadRealtimeStockDetail } from "./stockAnalysis.js";

const REALTIME_STOCK_CACHE_TTL_MS = 5 * 1000;

type CacheEntry = {
  expiresAt: number;
  value?: RealtimeStockDetail;
  pending?: Promise<RealtimeStockDetail>;
};

const detailCache = new Map<string, CacheEntry>();

function buildCacheKey(input: RealtimeStockRequest) {
  return `${input.symbol}:${input.anchorDate ?? "latest"}`;
}

async function getCachedRealtimeDetail(input: RealtimeStockRequest): Promise<RealtimeStockDetail> {
  const cacheKey = buildCacheKey(input);
  const cached = detailCache.get(cacheKey);
  const now = Date.now();

  if (cached?.value && cached.expiresAt > now) {
    return {
      ...cached.value,
      key: input.key ?? cached.value.key,
      name: input.name ?? cached.value.name,
      category: input.category ?? cached.value.category
    };
  }

  if (cached?.pending) {
    const value = await cached.pending;
    return {
      ...value,
      key: input.key ?? value.key,
      name: input.name ?? value.name,
      category: input.category ?? value.category
    };
  }

  const pending = loadRealtimeStockDetail(input)
    .then((value) => {
      detailCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + REALTIME_STOCK_CACHE_TTL_MS
      });
      return value;
    })
    .catch((error) => {
      detailCache.delete(cacheKey);
      throw error;
    });

  detailCache.set(cacheKey, {
    expiresAt: 0,
    pending
  });

  const value = await pending;
  return {
    ...value,
    key: input.key ?? value.key,
    name: input.name ?? value.name,
    category: input.category ?? value.category
  };
}

export async function getRealtimeStockDetail(input: RealtimeStockRequest) {
  return getCachedRealtimeDetail(input);
}

export async function getRealtimeStockSnapshots(inputs: RealtimeStockRequest[]) {
  const settled = await Promise.allSettled(inputs.map((input) => getCachedRealtimeDetail(input)));
  const items: RealtimeStockSnapshot[] = settled.map((result, index) => {
    const input = inputs[index];
    if (result.status === "fulfilled") {
      const value = result.value;
      return {
        key: input.key ?? value.key,
        name: input.name ?? value.name,
        symbol: input.symbol,
        resolvedSymbol: value.resolvedSymbol,
        category: input.category ?? value.category,
        latestClose: value.latestClose,
        previousClose: value.previousClose,
        changeAmount: value.changeAmount,
        changePercent: value.changePercent,
        latestDate: value.latestDate
      };
    }

    const message = result.reason instanceof Error ? result.reason.message : "실시간 시세를 불러오지 못했습니다.";
    return {
      key: input.key,
      name: input.name,
      symbol: input.symbol,
      resolvedSymbol: input.symbol,
      category: input.category,
      error: message
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
