import type { FundamentalsPeriod, FundamentalsSummary } from "../types.js";

const TABLE_MARKER = "\uC8FC\uC694\uC7AC\uBB34\uC815\uBCF4";
const ANALYSIS_SECTION_MARKER = "section cop_analysis";
const ANALYSIS_TABLE_CLASS = "tb_type1_ifrs";
const RECENT_ANNUAL = "\uCD5C\uADFC \uC5F0\uAC04";
const RECENT_QUARTER = "\uCD5C\uADFC \uBD84\uAE30";
const METRIC_REVENUE = ["\uB9E4\uCD9C\uC561"];
const METRIC_OPERATING_INCOME = ["\uC601\uC5C5\uC774\uC775"];
const METRIC_NET_INCOME = ["\uB2F9\uAE30\uC21C\uC774\uC775", "\uC9C0\uBC30\uC8FC\uC8FC\uC21C\uC774\uC775"];
const METRIC_DEBT_RATIO = ["\uBD80\uCC44\uBE44\uC728"];

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

async function readNaverHtml(response: Response): Promise<string> {
  return response.text();
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

function extractTable(html: string): string | undefined {
  const sectionStart = html.indexOf(ANALYSIS_SECTION_MARKER);
  if (sectionStart >= 0) {
    const sectionHtml = html.slice(sectionStart);
    const sectionTableMatch = sectionHtml.match(/<table[\s\S]*?<\/table>/i);
    if (sectionTableMatch) {
      return sectionTableMatch[0];
    }
  }

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tables.find(
    (table) =>
      table.includes(ANALYSIS_TABLE_CLASS) ||
      table.includes(TABLE_MARKER) ||
      table.includes(RECENT_ANNUAL) ||
      table.includes(RECENT_QUARTER)
  );
}

function extractHeaderCounts(tableHtml: string) {
  const theadMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
  if (!theadMatch) {
    return { annualCount: 0, quarterlyCount: 0 };
  }

  const rows = theadMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const topRow = rows[0] ?? "";
  const cells = [...topRow.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/gi)];

  let annualCount = 0;
  let quarterlyCount = 0;
  for (const [, attrs, inner] of cells) {
    const text = stripTags(inner);
    const colspanMatch = attrs.match(/colspan=["']?(\d+)/i);
    const colspan = colspanMatch ? Number(colspanMatch[1]) : 1;

    if (text.includes(RECENT_ANNUAL)) {
      annualCount = colspan;
    }

    if (text.includes(RECENT_QUARTER)) {
      quarterlyCount = colspan;
    }
  }

  return { annualCount, quarterlyCount };
}

function extractHeaderLabels(tableHtml: string) {
  const theadMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
  if (!theadMatch) {
    return [];
  }

  const rows = theadMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const labelRow = rows[1] ?? rows.at(-1) ?? "";
  const cells = [...labelRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  return cells.map((match) => stripTags(match[1])).filter(Boolean);
}

function extractBodyRows(tableHtml: string) {
  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  const rows = tbodyMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((rowHtml) => {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
      stripTags(match[1])
    );

    return {
      label: cells[0] ?? "",
      values: cells.slice(1)
    };
  });
}

function pickMetric(rows: Array<{ label: string; values: string[] }>, candidates: string[]) {
  return rows.find((row) => candidates.some((candidate) => row.label.includes(candidate)));
}

function buildPeriod(
  label: string | undefined,
  rows: Array<{ label: string; values: string[] }>,
  index: number
): FundamentalsPeriod | undefined {
  if (!label) {
    return undefined;
  }

  const revenue = pickMetric(rows, METRIC_REVENUE);
  const operatingIncome = pickMetric(rows, METRIC_OPERATING_INCOME);
  const netIncome = pickMetric(rows, METRIC_NET_INCOME);
  const roe = pickMetric(rows, ["ROE"]);
  const debtRatio = pickMetric(rows, METRIC_DEBT_RATIO);
  const eps = pickMetric(rows, ["EPS"]);
  const bps = pickMetric(rows, ["BPS"]);
  const per = pickMetric(rows, ["PER"]);
  const pbr = pickMetric(rows, ["PBR"]);

  return {
    label,
    revenue: parseNumber(revenue?.values[index] ?? ""),
    operatingIncome: parseNumber(operatingIncome?.values[index] ?? ""),
    netIncome: parseNumber(netIncome?.values[index] ?? ""),
    roe: parseNumber(roe?.values[index] ?? ""),
    debtRatio: parseNumber(debtRatio?.values[index] ?? ""),
    eps: parseNumber(eps?.values[index] ?? ""),
    bps: parseNumber(bps?.values[index] ?? ""),
    per: parseNumber(per?.values[index] ?? ""),
    pbr: parseNumber(pbr?.values[index] ?? "")
  };
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalsSummary | undefined> {
  if (!/^\d{6}$/.test(symbol)) {
    return undefined;
  }

  try {
    const response = await fetch(`https://finance.naver.com/item/main.naver?code=${symbol}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://finance.naver.com/"
      }
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await readNaverHtml(response);
    const tableHtml = extractTable(html);
    if (!tableHtml) {
      return undefined;
    }

    const { annualCount, quarterlyCount } = extractHeaderCounts(tableHtml);
    const labels = extractHeaderLabels(tableHtml);
    const rows = extractBodyRows(tableHtml);

    const annualLabels = labels.slice(0, annualCount);
    const quarterlyLabels = labels.slice(annualCount, annualCount + quarterlyCount);
    const annualIndex = annualLabels.length - 1;
    const quarterlyIndex = annualCount + quarterlyLabels.length - 1;

    return {
      source: "Naver Finance",
      annual: annualIndex >= 0 ? buildPeriod(annualLabels[annualIndex], rows, annualIndex) : undefined,
      quarterly:
        quarterlyLabels.length > 0
          ? buildPeriod(quarterlyLabels[quarterlyLabels.length - 1], rows, quarterlyIndex)
          : undefined
    };
  } catch {
    return undefined;
  }
}
