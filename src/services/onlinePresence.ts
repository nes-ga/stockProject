const ONLINE_VIEWER_TTL_MS = 45 * 1000;

type OnlineViewer = {
  lastSeenAt: number;
  page?: string;
  userAgent?: string;
};

const onlineViewers = new Map<string, OnlineViewer>();

function pruneOnlineViewers(now = Date.now()): void {
  for (const [viewerId, viewer] of onlineViewers.entries()) {
    if (now - viewer.lastSeenAt > ONLINE_VIEWER_TTL_MS) {
      onlineViewers.delete(viewerId);
    }
  }
}

export function heartbeatOnlineViewer(input: {
  viewerId: string;
  page?: string;
  userAgent?: string;
  seenAt?: number;
}) {
  const seenAt = input.seenAt ?? Date.now();
  pruneOnlineViewers(seenAt);
  onlineViewers.set(input.viewerId, {
    lastSeenAt: seenAt,
    page: input.page,
    userAgent: input.userAgent
  });
  return getOnlinePresenceSnapshot(seenAt);
}

export function getOnlinePresenceSnapshot(now = Date.now()) {
  pruneOnlineViewers(now);
  return {
    onlineCount: onlineViewers.size,
    staleAfterMs: ONLINE_VIEWER_TTL_MS,
    observedAt: new Date(now).toISOString()
  };
}
