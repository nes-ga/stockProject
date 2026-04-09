import type { ChartPoint } from "../../types.js";

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

export async function fetchLongTermChart(symbol: string, count: number): Promise<ChartPoint[]> {
  const url = new URL("https://fchart.stock.naver.com/sise.nhn");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(count));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://finance.naver.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Naver chart request failed with status ${response.status} for ${symbol}`);
  }

  const xml = await response.text();
  const points = parseNaverChartXml(xml);
  if (!points.length) {
    throw new Error(`No long-term chart data available for ${symbol}`);
  }

  return points;
}
