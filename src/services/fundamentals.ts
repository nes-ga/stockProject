import type { BusinessAreaSlice, FundamentalsPeriod, FundamentalsSummary } from "../types.js";

const FUNDAMENTALS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const utf8Decoder = new TextDecoder("utf-8");
const eucKrDecoder = new TextDecoder("euc-kr");
const TABLE_MARKER = "\uC8FC\uC694\uC7AC\uBB34\uC815\uBCF4";
const ANALYSIS_SECTION_MARKER = "section cop_analysis";
const ANALYSIS_TABLE_CLASS = "tb_type1_ifrs";
const RECENT_ANNUAL = "\uCD5C\uADFC \uC5F0\uAC04";
const RECENT_QUARTER = "\uCD5C\uADFC \uBD84\uAE30";
const METRIC_REVENUE = ["\uB9E4\uCD9C\uC561"];
const METRIC_OPERATING_INCOME = ["\uC601\uC5C5\uC774\uC775"];
const METRIC_NET_INCOME = ["\uB2F9\uAE30\uC21C\uC774\uC775", "\uC9C0\uBC30\uC8FC\uC8FC\uC21C\uC774\uC775"];
const METRIC_DEBT_RATIO = ["\uBD80\uCC44\uBE44\uC728"];

type BusinessAreaRule = {
  label: string;
  keywords: string[];
};

const BUSINESS_OVERVIEW_PATTERNS = [
  /<dt[^>]*>\s*\uAE30\uC5C5\uAC1C\uC694\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
  /<h4[^>]*>\s*\uAE30\uC5C5\uAC1C\uC694\s*<\/h4>[\s\S]{0,1200}?<p[^>]*>([\s\S]*?)<\/p>/i,
  /id=["']summary_info["'][^>]*>[\s\S]{0,1200}?<p[^>]*>([\s\S]*?)<\/p>/i,
  /class=["'][^"']*summary_info[^"']*["'][^>]*>[\s\S]{0,1200}?<p[^>]*>([\s\S]*?)<\/p>/i,
  /class=["'][^"']*summary_info[^"']*["'][^>]*>[\s\S]{0,1200}?<li[^>]*>([\s\S]*?)<\/li>/i
];

const BUSINESS_OVERVIEW_NOISE_KEYWORDS = [
  "\uC8FC\uAC00",
  "\uC2DC\uC138",
  "\uCC28\uD2B8",
  "\uD22C\uC790",
  "\uC99D\uAD8C",
  "\uB9AC\uD3EC\uD2B8",
  "\uCEE8\uC13C\uC11C\uC2A4",
  "\uBAA9\uD45C\uC8FC\uAC00",
  "\uAE08\uC735\uC815\uBCF4",
  "\uC218\uAE09",
  "\uAC70\uB798\uB7C9",
  "\uAC70\uB798\uB300\uAE08",
  "\uC2E4\uC801\uBC1C\uD45C",
  "\uC601\uC5C5\uC774\uC775",
  "PER",
  "PBR"
];

const BUSINESS_AREA_RULES: BusinessAreaRule[] = [
  { label: "\uBC18\uB3C4\uCCB4", keywords: ["\uBC18\uB3C4\uCCB4", "\uBA54\uBAA8\uB9AC", "\uD30C\uC6CC\uBC18\uB3C4\uCCB4", "\uC2DC\uC2A4\uD15CLSI", "\uD30C\uC6B4\uB4DC\uB9AC"] },
  { label: "\uBC18\uB3C4\uCCB4 \uC7A5\uBE44", keywords: ["\uBC18\uB3C4\uCCB4 \uC7A5\uBE44", "\uAC80\uC0AC\uC7A5\uBE44", "\uB178\uAD11", "\uC2DD\uAC01", "\uC131\uB9C9", "\uD6C4\uACF5\uC815", "\uC6E8\uC774\uD37C"] },
  { label: "\uB514\uC2A4\uD50C\uB808\uC774", keywords: ["\uB514\uC2A4\uD50C\uB808\uC774", "OLED", "LCD", "\uD328\uB110"] },
  { label: "2\uCC28\uC804\uC9C0", keywords: ["2\uCC28\uC804\uC9C0", "\uBC30\uD130\uB9AC", "\uC804\uC9C0", "\uC591\uADF9\uC7AC", "\uC74C\uADF9\uC7AC", "\uC804\uD574\uC9C8", "\uBD84\uB9AC\uB9C9"] },
  { label: "\uD654\uD559 \uC18C\uC7AC", keywords: ["\uD654\uD559", "\uC18C\uC7AC", "\uC218\uC9C0", "\uD569\uC131\uC218\uC9C0", "\uCCA8\uAC00\uC81C", "\uC2E4\uB9AC\uCF58", "\uD544\uB984"] },
  { label: "\uBC14\uC774\uC624\u00B7\uC81C\uC57D", keywords: ["\uC81C\uC57D", "\uC2E0\uC57D", "\uBC14\uC774\uC624", "\uD56D\uCCB4", "\uBC31\uC2E0", "\uC138\uD3EC", "\uC720\uC804\uC790", "CDMO"] },
  { label: "\uC758\uB8CC\uAE30\uAE30", keywords: ["\uC758\uB8CC\uAE30\uAE30", "\uC9C4\uB2E8", "\uD5EC\uC2A4\uCF00\uC5B4", "\uC2DC\uC57D", "\uD658\uC790\uAC10\uC2DC", "\uC601\uC0C1\uC9C4\uB2E8"] },
  { label: "\uAC8C\uC784", keywords: ["\uAC8C\uC784", "MMORPG", "\uBAA8\uBC14\uC77C \uAC8C\uC784", "\uCF58\uC194", "\uAC8C\uC784\uC18C\uD504\uD2B8"] },
  { label: "\uD50C\uB7AB\uD3FC\u00B7\uC18C\uD504\uD2B8\uC6E8\uC5B4", keywords: ["\uD50C\uB7AB\uD3FC", "\uC18C\uD504\uD2B8\uC6E8\uC5B4", "\uD074\uB77C\uC6B0\uB4DC", "SaaS", "\uBCF4\uC548", "\uC194\uB8E8\uC158", "\uC5C5\uBB34\uC6A9 SW"] },
  { label: "\uC5D4\uD130\u00B7\uCF58\uD150\uCE20", keywords: ["\uC5D4\uD130\uD14C\uC778\uBA3C\uD2B8", "\uC74C\uC6D0", "\uB4DC\uB77C\uB9C8", "\uCF58\uD150\uCE20", "\uB9E4\uB2C8\uC9C0\uBA3C\uD2B8", "\uC601\uC0C1 \uC81C\uC791"] },
  { label: "\uC790\uB3D9\uCC28\u00B7\uC804\uC7A5", keywords: ["\uC790\uB3D9\uCC28", "\uC804\uAE30\uCC28", "\uC804\uC7A5", "\uC790\uB3D9\uCC28 \uBD80\uD488", "\uC644\uC131\uCC28", "\uCC28\uB7C9\uC6A9"] },
  { label: "\uC5D0\uB108\uC9C0\u00B7\uC804\uB825", keywords: ["\uC804\uB825", "\uC5D0\uB108\uC9C0", "\uD0DC\uC591\uAD11", "\uD48D\uB825", "\uBC1C\uC804", "\uBCC0\uC555\uAE30", "\uC804\uB825\uAE30\uAE30"] },
  { label: "\uAE30\uACC4\u00B7\uC0B0\uC5C5\uC7AC", keywords: ["\uAE30\uACC4", "\uC0B0\uC5C5\uC6A9", "\uC124\uBE44", "\uD50C\uB79C\uD2B8", "\uC911\uC7A5\uBE44", "\uACF5\uC791\uAE30\uACC4"] },
  { label: "\uAC74\uC124\u00B7\uBD80\uB3D9\uC0B0", keywords: ["\uAC74\uC124", "\uC8FC\uD0DD", "\uBD80\uB3D9\uC0B0", "\uB514\uBCA8\uB85C\uD37C", "\uD1A0\uBAA9"] },
  { label: "\uC720\uD1B5\u00B7\uC18C\uBE44\uC7AC", keywords: ["\uC720\uD1B5", "\uB9C8\uD2B8", "\uD654\uC7A5\uD488", "\uC0DD\uD65C\uC6A9\uD488", "\uD328\uC158", "\uBDF0\uD2F0", "\uB9AC\uD14C\uC77C"] },
  { label: "\uC2DD\uC74C\uB8CC", keywords: ["\uC2DD\uD488", "\uC74C\uB8CC", "\uC8FC\uB958", "\uC2DD\uC790\uC7AC", "\uC720\uAC00\uACF5", "\uC81C\uACFC", "\uC81C\uBE75"] },
  { label: "\uBB3C\uB958\u00B7\uC6B4\uC1A1", keywords: ["\uBB3C\uB958", "\uC6B4\uC1A1", "\uD0DD\uBC30", "\uD574\uC6B4", "\uD56D\uACF5\uD654\uBB3C", "\uCC3D\uACE0"] },
  { label: "\uAE08\uC735", keywords: ["\uAE08\uC735", "\uC740\uD589", "\uBCF4\uD5D8", "\uC99D\uAD8C", "\uCE74\uB4DC", "\uC5EC\uC2E0"] },
  { label: "\uD1B5\uC2E0\u00B7\uB124\uD2B8\uC6CC\uD06C", keywords: ["\uD1B5\uC2E0", "5G", "\uB124\uD2B8\uC6CC\uD06C", "\uC911\uACC4\uAE30", "\uD1B5\uC2E0\uC7A5\uBE44"] },
  { label: "\uBC29\uC0B0\u00B7\uD56D\uACF5", keywords: ["\uBC29\uC0B0", "\uBBF8\uC0AC\uC77C", "\uB808\uC774\uB354", "\uD56D\uACF5", "\uC6B0\uC8FC", "\uAD70\uC218"] }
];

const fundamentalsCache = new Map<
  string,
  {
    fetchedAt: number;
    value: FundamentalsSummary | undefined;
  }
>();

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
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentType = response.headers.get("content-type") ?? "";
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = charsetMatch?.[1]?.trim().toLowerCase();

  if (charset?.includes("euc-kr") || charset?.includes("ks_c_5601") || charset?.includes("cp949")) {
    return eucKrDecoder.decode(bytes);
  }

  return utf8Decoder.decode(bytes);
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

function countKeywordMatches(text: string, keyword: string): number {
  if (!text || !keyword) {
    return 0;
  }

  let count = 0;
  let startIndex = 0;

  while (true) {
    const matchIndex = text.indexOf(keyword, startIndex);
    if (matchIndex === -1) {
      return count;
    }

    count += 1;
    startIndex = matchIndex + keyword.length;
  }
}

function getBusinessKeywordScore(text: string): number {
  return BUSINESS_AREA_RULES.reduce(
    (total, rule) => total + rule.keywords.reduce((sum, keyword) => sum + countKeywordMatches(text, keyword), 0),
    0
  );
}

function getBusinessNoiseScore(text: string): number {
  return BUSINESS_OVERVIEW_NOISE_KEYWORDS.reduce((sum, keyword) => sum + countKeywordMatches(text, keyword), 0);
}

function extractBusinessOverview(html: string): string | undefined {
  const candidates = BUSINESS_OVERVIEW_PATTERNS.flatMap((pattern) =>
    [...html.matchAll(new RegExp(pattern.source, `${pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`}`))]
      .map((match) => stripTags(match[1] ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length >= 20)
      .map((text) => ({
        text: text.slice(0, 320),
        businessScore: getBusinessKeywordScore(text),
        noiseScore: getBusinessNoiseScore(text)
      }))
  );

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      rankScore:
        candidate.businessScore * 5 -
        candidate.noiseScore * 4 +
        (candidate.text.length >= 40 && candidate.text.length <= 260 ? 2 : 0)
    }))
    .filter((candidate) => candidate.businessScore > 0)
    .sort((left, right) => right.rankScore - left.rankScore);

  return ranked[0]?.text;
}

function toBusinessAreaSlices(summary: string | undefined): BusinessAreaSlice[] | undefined {
  if (!summary) {
    return undefined;
  }

  const normalizedSummary = summary.replace(/\s+/g, " ").trim();
  const scored = BUSINESS_AREA_RULES.map((rule) => {
    const score = rule.keywords.reduce((sum, keyword) => sum + countKeywordMatches(normalizedSummary, keyword), 0);
    return {
      label: rule.label,
      score
    };
  })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const totalScore = scored.reduce((sum, item) => sum + item.score, 0);
  if (!scored.length || totalScore < 2) {
    return undefined;
  }

  const shares = scored.map((item) => {
    const exactWeight = (item.score / totalScore) * 100;
    const floorWeight = Math.floor(exactWeight);
    return {
      ...item,
      weight: floorWeight,
      remainder: exactWeight - floorWeight
    };
  });

  let remaining = 100 - shares.reduce((sum, item) => sum + item.weight, 0);
  shares.sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; index < shares.length && remaining > 0; index += 1) {
    shares[index].weight += 1;
    remaining -= 1;
  }

  return shares
    .sort((left, right) => right.weight - left.weight)
    .map((item) => ({
      label: item.label,
      weight: item.weight,
      source: "overview_estimated" as const
    }));
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

function hasMeaningfulValue(value: string | undefined): boolean {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

function isEstimatedPeriodLabel(label: string | undefined): boolean {
  if (!label) {
    return false;
  }

  return label.replace(/\s+/g, "").includes("(E)");
}

function findLatestPopulatedIndex(
  rows: Array<{ label: string; values: string[] }>,
  labels: string[],
  startIndex: number
) {
  if (!labels.length) {
    return undefined;
  }

  const tryFind = (excludeEstimated: boolean) => {
    for (let relativeIndex = labels.length - 1; relativeIndex >= 0; relativeIndex -= 1) {
      if (excludeEstimated && isEstimatedPeriodLabel(labels[relativeIndex])) {
        continue;
      }

      const index = startIndex + relativeIndex;
      const hasAnyMetricValue = rows.some((row) => hasMeaningfulValue(row.values[index]));
      if (hasAnyMetricValue) {
        return { index, labelIndex: relativeIndex };
      }
    }

    return undefined;
  };

  return tryFind(true) ?? tryFind(false);
}

function collectPopulatedPeriods(
  rows: Array<{ label: string; values: string[] }>,
  labels: string[],
  startIndex: number,
  limit: number,
  mode: "all" | "actual" | "estimated" = "all"
) {
  if (!labels.length || limit <= 0) {
    return [];
  }

  const selections: Array<{ index: number; labelIndex: number }> = [];
  const selectedIndices = new Set<number>();
  for (let relativeIndex = labels.length - 1; relativeIndex >= 0; relativeIndex -= 1) {
    if (selections.length >= limit) {
      break;
    }

    const estimated = isEstimatedPeriodLabel(labels[relativeIndex]);
    if (mode === "actual" && estimated) {
      continue;
    }
    if (mode === "estimated" && !estimated) {
      continue;
    }

    const index = startIndex + relativeIndex;
    if (selectedIndices.has(index)) {
      continue;
    }

    const hasAnyMetricValue = rows.some((row) => hasMeaningfulValue(row.values[index]));
    if (!hasAnyMetricValue) {
      continue;
    }

    selections.push({ index, labelIndex: relativeIndex });
    selectedIndices.add(index);
  }

  return selections.sort((left, right) => left.index - right.index);
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
    isEstimated: isEstimatedPeriodLabel(label),
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

  const cached = fundamentalsCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < FUNDAMENTALS_CACHE_TTL_MS) {
    return cached.value;
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
    const businessSummary = extractBusinessOverview(html);
    const businessAreas = toBusinessAreaSlices(businessSummary);
    const tableHtml = extractTable(html);
    if (!tableHtml && !businessAreas?.length) {
      return undefined;
    }

    let annual: FundamentalsPeriod | undefined;
    let quarterly: FundamentalsPeriod | undefined;
    let annualHistory: FundamentalsPeriod[] | undefined;
    let quarterlyHistory: FundamentalsPeriod[] | undefined;
    let quarterlyEstimateHistory: FundamentalsPeriod[] | undefined;

    if (tableHtml) {
      const { annualCount, quarterlyCount } = extractHeaderCounts(tableHtml);
      const labels = extractHeaderLabels(tableHtml);
      const rows = extractBodyRows(tableHtml);

      const annualLabels = labels.slice(0, annualCount);
      const quarterlyLabels = labels.slice(annualCount, annualCount + quarterlyCount);
      const annualPeriod = findLatestPopulatedIndex(rows, annualLabels, 0);
      const quarterlyPeriod = findLatestPopulatedIndex(rows, quarterlyLabels, annualCount);
      annualHistory = collectPopulatedPeriods(rows, annualLabels, 0, 2, "actual")
        .map((period) => buildPeriod(annualLabels[period.labelIndex], rows, period.index))
        .filter((period): period is FundamentalsPeriod => Boolean(period));
      quarterlyHistory = collectPopulatedPeriods(rows, quarterlyLabels, annualCount, 8, "actual")
        .map((period) => buildPeriod(quarterlyLabels[period.labelIndex], rows, period.index))
        .filter((period): period is FundamentalsPeriod => Boolean(period));
      quarterlyEstimateHistory = collectPopulatedPeriods(rows, quarterlyLabels, annualCount, 8, "estimated")
        .map((period) => buildPeriod(quarterlyLabels[period.labelIndex], rows, period.index))
        .filter((period): period is FundamentalsPeriod => Boolean(period));

      annual =
        annualPeriod != null
          ? buildPeriod(annualLabels[annualPeriod.labelIndex], rows, annualPeriod.index)
          : undefined;
      quarterly =
        quarterlyPeriod != null
          ? buildPeriod(quarterlyLabels[quarterlyPeriod.labelIndex], rows, quarterlyPeriod.index)
          : undefined;
    }

    const result = {
      source: "Naver Finance",
      annual,
      quarterly,
      annualHistory,
      quarterlyHistory,
      quarterlyEstimateHistory,
      businessAreasSource: businessAreas?.length ? "Naver Finance 기업개요 기반 자동 추정" : undefined,
      businessSummary,
      businessAreas
    };
    fundamentalsCache.set(symbol, {
      fetchedAt: Date.now(),
      value: result
    });

    return result;
  } catch {
    fundamentalsCache.set(symbol, {
      fetchedAt: Date.now(),
      value: undefined
    });
    return undefined;
  }
}
