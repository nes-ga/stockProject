import React, { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const eventLabels = {
  EARNINGS: "실적",
  CONTRACT: "수주계약",
  "M&A": "M&A",
  POLICY: "정책",
  CAPEX: "설비투자",
  SHAREHOLDER: "주주환원",
  RISK: "리스크"
};

const sentimentLabels = {
  positive: "positive",
  negative: "negative"
};

const CLIENT_REFRESH_INTERVAL_MS = 60 * 1000;

function NewsSignalDashboard() {
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const hasHydratedSignalsRef = useRef(false);
  const seenSignalKeysRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadSignals({ keepPrevious = false } = {}) {
      try {
        if (!keepPrevious) {
          setIsLoading(true);
        }
        setError("");

        const response = await fetch("/analysis/news-signals");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "뉴스 시그널 데이터를 불러오지 못했습니다.");
        }

        if (!cancelled) {
          const nextSignals = Array.isArray(data.signals) ? data.signals : [];
          const nextKeys = new Set(nextSignals.map((signal) => createSignalToastKey(signal)));
          if (hasHydratedSignalsRef.current) {
            const newSignals = nextSignals.filter((signal) => !seenSignalKeysRef.current.has(createSignalToastKey(signal)));
            if (newSignals.length) {
              announceNewsSignals(newSignals);
            }
          }
          seenSignalKeysRef.current = nextKeys;
          hasHydratedSignalsRef.current = true;
          setPayload(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSignals();

    const intervalId = window.setInterval(() => {
      void loadSignals({ keepPrevious: true });
    }, CLIENT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const signals = Array.isArray(payload?.signals) ? payload.signals : [];
  const sectors = Array.isArray(payload?.sectors) ? payload.sectors : [];
  const highSignals = mergeSignalsByTicker(signals
    .filter((signal) => signal.sentiment === "positive" && signal.score >= 7)
    .sort((left, right) => right.score - left.score || Date.parse(right.timestamp) - Date.parse(left.timestamp)));
  const radarSignals = mergeSignalsByTicker(signals
    .filter((signal) => signal.sentiment === "positive" && signal.score < 7)
    .sort((left, right) => right.score - left.score || Date.parse(right.timestamp) - Date.parse(left.timestamp)));
  const riskSignals = mergeSignalsByTicker(signals
    .filter((signal) => signal.sentiment === "negative")
    .sort((left, right) => left.score - right.score || Date.parse(right.timestamp) - Date.parse(left.timestamp)));

  return (
    <div className="news-dashboard">
      <section className="panel news-dashboard-hero">
        <div className="news-dashboard-head">
          <div>
            <p className="eyebrow news-dashboard-eyebrow">News Signal Engine</p>
            <h2>이벤트 기반 뉴스 시그널</h2>
            <p className="field-help">
              개별 기사 목록이 아니라 같은 종목, 같은 이벤트, 1시간 내 보도를 하나의 시그널 카드로 묶어 트레이딩 판단에
              바로 쓰도록 정리했습니다.
            </p>
          </div>
          <div className="news-dashboard-stamp">
            <span className="selected-stock-label">마지막 업데이트</span>
            <strong>{payload?.lastUpdatedAt ? formatDateTime(payload.lastUpdatedAt) : "-"}</strong>
            <span className="news-dashboard-stamp-copy">
              {payload?.refreshIntervalMinutes ? `${payload.refreshIntervalMinutes}분 주기 업데이트` : "주기 정보 없음"}
            </span>
          </div>
        </div>

        <div className="news-dashboard-stats">
          <StatCard label="원본 기사" value={`${payload?.articleCount ?? 0}건`} tone="neutral" />
          <StatCard label="시그널 카드" value={`${payload?.signalCount ?? 0}건`} tone="positive" />
          <StatCard label="High Signal" value={`${highSignals.length}건`} tone="positive" />
          <StatCard label="Risk Alerts" value={`${riskSignals.length}건`} tone="negative" />
        </div>
      </section>

      {error ? (
        <section className="panel news-dashboard-panel">
          <div className="error-box news-dashboard-error-box">{error}</div>
        </section>
      ) : null}

      {isLoading ? (
        <section className="panel news-dashboard-panel">
          <div className="empty-state news-empty-state">
            <p>이벤트 추출, 종목 매핑, 시그널 그룹핑을 수행하는 중입니다.</p>
            <p>동일 이벤트는 한 장의 카드로 묶여서 표시됩니다.</p>
          </div>
        </section>
      ) : (
        <>
          <div className="news-dashboard-grid">
            <SignalSection
              title="High Signal"
              caption="점수 7 이상인 상단 시그널을 우선 배치합니다."
              items={highSignals}
              emptyMessage="현재 점수 7 이상인 강한 이벤트 시그널이 없습니다."
            />
            <SignalSection
              title="Risk Alerts"
              caption="희석, 재무, 공시 리스크는 별도 경고 보드로 분리합니다."
              items={riskSignals}
              emptyMessage="현재 포착된 리스크 이벤트가 없습니다."
            />
          </div>

          <div className="news-dashboard-grid news-dashboard-grid-secondary">
            <SignalSection
              title="Opportunity Radar"
              caption="정책, 투자, 주주환원 등 후속 확인이 필요한 보조 시그널입니다."
              items={radarSignals}
              emptyMessage="현재 보조 관찰이 필요한 긍정 이벤트가 없습니다."
            />

            <section className="panel news-dashboard-panel">
              <div className="panel-head">
                <div>
                  <h2>Sector / Market</h2>
                  <p className="field-help">시그널이 모인 업종을 묶어서 현재 시장의 재료 밀집도를 빠르게 봅니다.</p>
                </div>
              </div>

              {sectors.length ? (
                <div className="news-sector-list">
                  {sectors.map((sector) => (
                    <article key={sector.sector} className="news-sector-card">
                      <div className="news-sector-head">
                        <div>
                          <h3>{sector.sector}</h3>
                          <p>
                            리드 종목 {sector.leadCompanyName} ({sector.leadTicker})
                          </p>
                        </div>
                        <span
                          className={`news-sector-score ${
                            sector.totalScore > 0 ? "positive" : sector.totalScore < 0 ? "negative" : "neutral"
                          }`}
                        >
                          {formatScore(sector.totalScore)}
                        </span>
                      </div>
                      <div className="news-sector-metrics">
                        <span>시그널 {sector.signalCount}건</span>
                        <span>긍정 {sector.positiveCount}건</span>
                        <span>부정 {sector.negativeCount}건</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state news-empty-state">
                  <p>현재 집계할 업종 시그널이 없습니다.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SignalSection({ title, caption, items, emptyMessage }) {
  return (
    <section className="panel news-dashboard-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p className="field-help">{caption}</p>
        </div>
      </div>

      {items.length ? (
        <div className={`news-signal-list ${items.length > 3 ? "is-scrollable" : ""}`}>
          {items.map((item) => (
            <SignalCard key={`${item.ticker}-${item.eventType}-${item.timestamp}`} signal={item} />
          ))}
        </div>
      ) : (
        <div className="empty-state news-empty-state">
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

function mergeSignalsByTicker(items) {
  const groups = new Map();

  for (const signal of items) {
    const key = signal.ticker || signal.companyName;
    const current = groups.get(key);
    groups.set(key, current ? [...current, signal] : [signal]);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) {
      return group[0];
    }

    const representative = group[0];
    const eventTypes = [...new Set(group.map((item) => item.eventType).filter(Boolean))];
    const sources = [...new Set(group.flatMap((item) => item.sources ?? []))];
    const newsList = dedupeNewsList(group.flatMap((item) => item.newsList ?? []));
    const latestTimestamp = group
      .map((item) => item.timestamp)
      .filter(Boolean)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? representative.timestamp;
    const score =
      representative.sentiment === "negative"
        ? Math.min(...group.map((item) => item.score))
        : Math.max(...group.map((item) => item.score));
    const eventLabelList = eventTypes.map((type) => eventLabels[type] ?? type);
    const eventLabelText = eventLabelList.join(", ");

    return {
      ...representative,
      score,
      eventType: representative.eventType,
      displayEventLabels: eventLabelList,
      articleCount: newsList.length,
      sources,
      timestamp: latestTimestamp,
      summary: `${representative.companyName}, ${eventLabelText} 관련 시그널 ${group.length}건을 하나로 묶었습니다. 기사 ${newsList.length}건과 매체 ${sources.length}곳을 함께 확인합니다.`,
      newsList
    };
  });
}

function dedupeNewsList(items) {
  const seen = new Set();
  return [...items]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .filter((item) => {
      const key = [item.url, item.title, item.publishedAt].filter(Boolean).join("|");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function getSignalEventLabels(signal) {
  return Array.isArray(signal.displayEventLabels) && signal.displayEventLabels.length
    ? signal.displayEventLabels
    : [eventLabels[signal.eventType] ?? signal.eventType];
}

function SignalCard({ signal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`news-signal-card ${signal.sentiment}`}>
      <div className="news-signal-card-head">
        <div className="news-signal-title-wrap">
          <div className="news-signal-title-row">
            <strong>{signal.companyName}</strong>
            {getSignalEventLabels(signal).map((label) => (
              <span key={label} className={`news-event-badge ${signal.sentiment.toLowerCase()}`}>
                {label}
              </span>
            ))}
          </div>
          <div className="news-signal-meta">
            <span>{signal.ticker}</span>
            <span>{signal.sources.join(", ")}</span>
            <span>{formatDateTime(signal.timestamp)}</span>
          </div>
        </div>

        <div className={`news-signal-score ${sentimentLabels[signal.sentiment]}`}>{formatScore(signal.score)}</div>
      </div>

      <p className="news-signal-summary">{signal.summary}</p>

      <div className="news-signal-footer">
        <div className="news-signal-footer-meta">
          <span>기사 {signal.articleCount}건</span>
          <span>매체 {signal.sources.length}곳</span>
        </div>
        <button className="ghost-button small-button" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide News" : "View News"}
        </button>
      </div>

      {expanded ? (
        <div className={`news-signal-expand ${signal.newsList.length > 3 ? "is-scrollable" : ""}`}>
          {signal.newsList.map((news) => {
            const hasLiveUrl = isLiveNewsUrl(news.url);
            const TagName = hasLiveUrl ? "a" : "div";

            return (
              <TagName
                key={`${news.url}-${news.publishedAt}`}
                className={`news-signal-news-item ${hasLiveUrl ? "is-link" : "is-disabled"}`}
                href={hasLiveUrl ? news.url : undefined}
                target={hasLiveUrl ? "_blank" : undefined}
                rel={hasLiveUrl ? "noreferrer" : undefined}
              >
                <div className="news-signal-news-copy">
                  <span className="news-signal-news-stock">
                    {news.companyName ?? signal.companyName}
                    {" · "}
                    {news.ticker ?? signal.ticker}
                  </span>
                  <strong>{news.title}</strong>
                  <span>
                    {news.source} · {formatDateTime(news.publishedAt)}
                  </span>
                </div>
                <span className={`news-signal-news-action ${hasLiveUrl ? "is-live" : "is-pending"}`}>
                  {hasLiveUrl ? "원문 보기" : "연동 예정"}
                </span>
              </TagName>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`news-stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatScore(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}

function isLiveNewsUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function createSignalToastKey(signal) {
  return [signal?.ticker, signal?.eventType, signal?.timestamp, signal?.summary].filter(Boolean).join("|");
}

function announceNewsSignals(signals) {
  if (typeof window === "undefined" || typeof window.showAppToast !== "function" || !signals.length) {
    return;
  }

  const sorted = [...signals].sort(
    (left, right) => Math.abs(right.score ?? 0) - Math.abs(left.score ?? 0) || Date.parse(right.timestamp) - Date.parse(left.timestamp)
  );
  const headline = sorted[0];
  const eventLabel = eventLabels[headline.eventType] ?? headline.eventType ?? "이벤트";
  const title = signals.length > 1 ? `새 뉴스 이벤트 ${signals.length}건` : "새 뉴스 이벤트";
  const message = `${headline.companyName} · ${eventLabel} · 점수 ${formatScore(headline.score)}${signals.length > 1 ? " 포함" : ""}`;

  window.showAppToast({
    title,
    message,
    tone: headline.sentiment === "negative" ? "negative" : "positive",
    duration: 5200
  });
}

const rootElement = document.querySelector("#newsSignalRoot");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <NewsSignalDashboard />
    </StrictMode>
  );
}
