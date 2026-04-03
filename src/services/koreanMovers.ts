import type {
  ChartPoint,
  KoreanMoverAnalysis,
  KoreanMoverDirection,
  KoreanMoverMarket,
  KoreanMoverSignal
} from "../types.js";

type KoreanMoverCandidate = {
  market: KoreanMoverMarket;
  direction: KoreanMoverDirection;
  symbol: string;
  name: string;
  price: number;
  changeAmount?: number;
  changePercent?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
};

const eucKrDecoder = new TextDecoder("euc-kr");

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function readNaverHtml(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return eucKrDecoder.decode(new Uint8Array(buffer));
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function parseNumber(value: string): number | undefined {
  const normalized = value.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  if (!normalized || normalized === "-" || Number.isNaN(Number(normalized))) {
    return undefined;
  }

  return Number(normalized);
}

function average(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(value?: number, base?: number): number | undefined {
  if (value == null || base == null || base === 0) {
    return undefined;
  }

  return value / base;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseNaverChartXml(xml: string): ChartPoint[] {
  const itemRegex = /<item[^>]+data="([^"]+)"/g;
  const points: ChartPoint[] = [];

  for (const match of xml.matchAll(itemRegex)) {
    const raw = match[1];
    const [date, open, high, low, close, volume] = raw.split("|");
    if (!date || !close) {
      continue;
    }

    points.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume ? Number(volume) : undefined
    });
  }

  return points;
}

async function fetchNaverChart(symbol: string, count = 120) {
  const url = new URL("https://fchart.stock.naver.com/sise.nhn");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(count));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://finance.naver.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Naver chart request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const points = parseNaverChartXml(xml);
  if (!points.length) {
    throw new Error(`No Naver chart data available for ${symbol}`);
  }

  return points;
}

function extractMoverTable(html: string): string | undefined {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tables.find((table) => /class=["'][^"']*type_2[^"']*["']/i.test(table));
}

function parseMoverRows(html: string, market: KoreanMoverMarket, direction: KoreanMoverDirection): KoreanMoverCandidate[] {
  const tableHtml = extractMoverTable(html);
  if (!tableHtml) {
    return [];
  }

  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  const scope = tbodyMatch?.[0] ?? tableHtml;
  const rowMatches = scope.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: KoreanMoverCandidate[] = [];

  for (const rowHtml of rowMatches) {
    const codeMatch = rowHtml.match(/item\/main\.naver\?code=(\d{6})/i);
    if (!codeMatch) {
      continue;
    }

    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    if (cells.length < 9) {
      continue;
    }

    const name = cells[1];
    const price = parseNumber(cells[2]);
    if (!name || price == null) {
      continue;
    }

    items.push({
      market,
      direction,
      symbol: codeMatch[1],
      name,
      price,
      changeAmount: parseNumber(cells[3]),
      changePercent: parseNumber(cells[4]),
      volume: parseNumber(cells[5]),
      open: parseNumber(cells[6]),
      high: parseNumber(cells[7]),
      low: parseNumber(cells[8])
    });
  }

  return items;
}

async function fetchKoreanMoversByMarket(
  market: KoreanMoverMarket,
  direction: KoreanMoverDirection
): Promise<KoreanMoverCandidate[]> {
  const url = new URL(
    direction === "rise" ? "https://finance.naver.com/sise/sise_rise.naver" : "https://finance.naver.com/sise/sise_fall.naver"
  );
  url.searchParams.set("sosok", market === "KOSPI" ? "0" : "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://finance.naver.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Naver movers request failed with status ${response.status}`);
  }

  const html = await readNaverHtml(response);
  return parseMoverRows(html, market, direction);
}

function computeSignal(
  candidate: KoreanMoverCandidate,
  points: ChartPoint[],
  minVolumeRatio: number
): KoreanMoverAnalysis {
  const latestPoint = points.at(-1);
  const previousClose = points.length >= 2 ? points.at(-2)?.close : undefined;
  const trailing20 = points.slice(-21, -1);
  const trailing60 = points.slice(-61, -1);
  const trailingVolumes20 = trailing20
    .map((point) => point.volume)
    .filter((value): value is number => typeof value === "number");
  const avgVolume20 = average(trailingVolumes20);
  const volumeRatio20d = ratio(candidate.volume ?? latestPoint?.volume, avgVolume20);
  const highClose20d =
    trailing20.length > 0 ? Math.max(...trailing20.map((point) => point.close)) : undefined;
  const highClose60d =
    trailing60.length > 0 ? Math.max(...trailing60.map((point) => point.close)) : undefined;
  const lowClose20d =
    trailing20.length > 0 ? Math.min(...trailing20.map((point) => point.close)) : undefined;
  const lowClose60d =
    trailing60.length > 0 ? Math.min(...trailing60.map((point) => point.close)) : undefined;
  const breakout20d = highClose20d != null ? candidate.price >= highClose20d : false;
  const breakout60d = highClose60d != null ? candidate.price >= highClose60d : false;
  const breakdown20d = lowClose20d != null ? candidate.price <= lowClose20d : false;
  const breakdown60d = lowClose60d != null ? candidate.price <= lowClose60d : false;
  const closedNearHigh = candidate.high != null ? candidate.price >= candidate.high * 0.985 : false;
  const closedNearLow = candidate.low != null ? candidate.price <= candidate.low * 1.015 : false;
  const estimatedTurnover =
    candidate.price != null && candidate.volume != null ? candidate.price * candidate.volume : undefined;

  let score = 0;
  const reasons: string[] = [];
  const rawChangePercent = candidate.changePercent ?? 0;
  const movePercent = Math.abs(rawChangePercent);

  if (movePercent >= 20) {
    score += 35;
    reasons.push(
      candidate.direction === "rise"
        ? `주가가 ${rawChangePercent.toFixed(1)}% 급등했습니다`
        : `주가가 ${rawChangePercent.toFixed(1)}% 급락했습니다`
    );
  } else if (movePercent >= 12) {
    score += 25;
    reasons.push(
      candidate.direction === "rise"
        ? `주가가 ${rawChangePercent.toFixed(1)}% 크게 상승했습니다`
        : `주가가 ${rawChangePercent.toFixed(1)}% 크게 하락했습니다`
    );
  } else if (movePercent >= 7) {
    score += 15;
    reasons.push(
      candidate.direction === "rise"
        ? `주가가 ${rawChangePercent.toFixed(1)}% 상승했습니다`
        : `주가가 ${rawChangePercent.toFixed(1)}% 하락했습니다`
    );
  }

  if (volumeRatio20d != null && volumeRatio20d >= Math.max(minVolumeRatio, 6)) {
    score += 35;
    reasons.push(`거래량이 20일 평균 대비 ${volumeRatio20d.toFixed(1)}배입니다`);
  } else if (volumeRatio20d != null && volumeRatio20d >= Math.max(minVolumeRatio, 3)) {
    score += 25;
    reasons.push(`거래량이 20일 평균 대비 ${volumeRatio20d.toFixed(1)}배입니다`);
  } else if (volumeRatio20d != null && volumeRatio20d >= minVolumeRatio) {
    score += 15;
    reasons.push(`거래량이 20일 평균 대비 ${volumeRatio20d.toFixed(1)}배입니다`);
  }

  if (candidate.direction === "rise") {
    if (breakout60d) {
      score += 20;
      reasons.push("60일 종가 고점을 돌파했습니다");
    } else if (breakout20d) {
      score += 12;
      reasons.push("20일 종가 고점을 돌파했습니다");
    }

    if (closedNearHigh) {
      score += 10;
      reasons.push("장중 고가 부근을 유지하고 있습니다");
    }
  } else {
    if (breakdown60d) {
      score += 20;
      reasons.push("60일 종가 저점을 이탈했습니다");
    } else if (breakdown20d) {
      score += 12;
      reasons.push("20일 종가 저점을 이탈했습니다");
    }

    if (closedNearLow) {
      score += 10;
      reasons.push("장중 저가 부근을 유지하고 있습니다");
    }
  }

  if (estimatedTurnover != null && estimatedTurnover >= 100_000_000_000) {
    score += 10;
    reasons.push("거래대금이 1,000억 원 이상입니다");
  } else if (estimatedTurnover != null && estimatedTurnover >= 30_000_000_000) {
    score += 5;
    reasons.push("거래대금이 300억 원 이상입니다");
  }

  score = clamp(score, 0, 100);

  let signal: KoreanMoverSignal = "watch";
  if (score >= 80) {
    signal = "explosive";
  } else if (score >= 60) {
    signal = "strong";
  }

  const summary =
    reasons.length > 0
      ? reasons.join(", ")
      : candidate.direction === "rise"
        ? "상승은 나왔지만 거래량과 돌파 신호는 아직 약합니다."
        : "하락은 나왔지만 거래량과 이탈 신호는 아직 약합니다.";

  return {
    market: candidate.market,
    direction: candidate.direction,
    symbol: candidate.symbol,
    name: candidate.name,
    price: candidate.price,
    previousClose,
    changeAmount: candidate.changeAmount,
    changePercent: candidate.changePercent,
    volume: candidate.volume,
    open: candidate.open,
    high: candidate.high,
    low: candidate.low,
    estimatedTurnover,
    latestDate: latestPoint?.date ?? toIsoDate(new Date()),
    avgVolume20,
    volumeRatio20d,
    highClose20d,
    highClose60d,
    lowClose20d,
    lowClose60d,
    breakout20d,
    breakout60d,
    breakdown20d,
    breakdown60d,
    closedNearHigh,
    closedNearLow,
    alertScore: score,
    signal,
    reasons,
    summary
  };
}

async function enrichCandidate(
  candidate: KoreanMoverCandidate,
  minVolumeRatio: number
): Promise<KoreanMoverAnalysis> {
  try {
    const points = await fetchNaverChart(candidate.symbol, 120);
    return computeSignal(candidate, points, minVolumeRatio);
  } catch {
    const estimatedTurnover =
      candidate.price != null && candidate.volume != null ? candidate.price * candidate.volume : undefined;

    return {
      market: candidate.market,
      direction: candidate.direction,
      symbol: candidate.symbol,
      name: candidate.name,
      price: candidate.price,
      changeAmount: candidate.changeAmount,
      changePercent: candidate.changePercent,
      volume: candidate.volume,
      open: candidate.open,
      high: candidate.high,
      low: candidate.low,
      estimatedTurnover,
      latestDate: undefined,
      avgVolume20: undefined,
      volumeRatio20d: undefined,
      highClose20d: undefined,
      highClose60d: undefined,
      lowClose20d: undefined,
      lowClose60d: undefined,
      breakout20d: false,
      breakout60d: false,
      breakdown20d: false,
      breakdown60d: false,
      closedNearHigh: candidate.high != null ? candidate.price >= candidate.high * 0.985 : false,
      closedNearLow: candidate.low != null ? candidate.price <= candidate.low * 1.015 : false,
      alertScore: Math.abs(candidate.changePercent ?? 0) >= 12 ? 40 : 20,
      signal: "watch",
      reasons: ["순위 페이지에서는 급변 신호가 보였지만 차트 보강 데이터는 불러오지 못했습니다"],
      summary: "순위 페이지에서는 급변 신호가 보였지만 차트 보강 데이터는 불러오지 못했습니다."
    };
  }
}

export async function analyzeKoreanMovers(options?: {
  direction?: KoreanMoverDirection;
  market?: "all" | KoreanMoverMarket;
  limit?: number;
  minChangePercent?: number;
  minVolumeRatio?: number;
  minAlertScore?: number;
}): Promise<KoreanMoverAnalysis[]> {
  const direction = options?.direction ?? "rise";
  const market = options?.market ?? "all";
  const limit = options?.limit ?? 20;
  const minChangePercent = options?.minChangePercent ?? 5;
  const minVolumeRatio = options?.minVolumeRatio ?? 2;
  const minAlertScore = options?.minAlertScore ?? 40;

  const markets: KoreanMoverMarket[] = market === "all" ? ["KOSPI", "KOSDAQ"] : [market];

  const ranked = (
    await Promise.all(markets.map((targetMarket) => fetchKoreanMoversByMarket(targetMarket, direction)))
  )
    .flat()
    .filter((item) =>
      direction === "rise" ? (item.changePercent ?? 0) >= minChangePercent : Math.abs(item.changePercent ?? 0) >= minChangePercent
    )
    .sort((left, right) => {
      const rightScore = Math.abs(right.changePercent ?? -Infinity);
      const leftScore = Math.abs(left.changePercent ?? -Infinity);
      return rightScore - leftScore;
    });

  const sampleSize = Math.max(limit * 2, 20);
  const enriched = await Promise.all(
    ranked.slice(0, sampleSize).map((candidate) => enrichCandidate(candidate, minVolumeRatio))
  );

  return enriched
    .filter((item) => item.alertScore >= minAlertScore)
    .sort((left, right) => {
      if (right.alertScore !== left.alertScore) {
        return right.alertScore - left.alertScore;
      }
      return Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0);
    })
    .slice(0, limit);
}
