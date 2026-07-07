import { mkdir } from "node:fs/promises";
import path from "node:path";
import Tesseract from "tesseract.js";
import { readPortfolioHoldings } from "./holdingsStorage.js";
import type { OriginalIntent, PortfolioHolding, PortfolioScreenshotDraftHolding, PortfolioScreenshotParseResult } from "./types.js";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const TESSERACT_CACHE_DIR = path.join(process.cwd(), ".cache", "tesseract");
const OCR_LANGUAGES = "kor+eng";

type OcrWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

let workerPromise: Promise<OcrWorker> | null = null;

const summaryLabels = [
  "예수금",
  "주문가능",
  "출금가능",
  "총자산",
  "추정자산",
  "총평가",
  "총손익",
  "총수익",
  "잔고현황",
  "보유잔고",
  "매입합계",
  "평가합계",
  "계좌",
  "D+1",
  "D+2"
];

const strongUiNoiseLabels = [
  "추정자산",
  "자산현황",
  "실시간",
  "업데이트",
  "새로고침",
  "조회",
  "검색",
  "설정",
  "메뉴",
  "원화",
  "계좌",
  "평가손익",
  "보유비중",
  "일별손익"
];

const weakUiNoiseLabels = [
  "ON",
  "OFF",
  "전체",
  "국내주식",
  "해외주식",
  "주문",
  "매수",
  "매도",
  "입금",
  "출금",
  "이체"
];

const headerLabels = [
  "종목명",
  "보유종목",
  "평균단가",
  "매입단가",
  "현재가",
  "보유수량",
  "수량",
  "손익률",
  "수익률",
  "매입금액",
  "평가금액"
];

const fieldLabels = {
  avgPrice: ["평균단가", "평단", "매입단가", "매수가"],
  currentPrice: ["현재가", "현재가격", "평가단가"],
  quantity: ["보유수량", "수량", "잔고수량", "주식수"],
  investedAmount: ["매입금액", "총매입", "매수금액", "매입가액"],
  evaluationAmount: ["평가금액", "평가액", "평가금"],
  profitRate: ["손익률", "수익률", "손실률"],
  profitAmount: ["평가손익", "손익금액", "평가손", "손익"]
};

function compactText(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function normalizeLine(value: string): string {
  return value.replace(/[|·•]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAnyCompact(value: string, labels: string[]): boolean {
  const compact = compactText(value);
  return labels.some((label) => compact.includes(label));
}

function includesAnyCompactIgnoreCase(value: string, labels: string[]): boolean {
  const compact = compactText(value).toUpperCase();
  return labels.some((label) => compact.includes(compactText(label).toUpperCase()));
}

function parseImageDataUrl(imageDataUrl: string): Buffer {
  const match = /^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i.exec(imageDataUrl);
  if (!match) {
    throw new Error("PNG, JPG, WEBP 스크린샷만 로컬 OCR로 판독할 수 있습니다.");
  }

  const buffer = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (!buffer.length) {
    throw new Error("이미지 데이터가 비어 있습니다.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("스크린샷이 너무 큽니다. 12MB 이하 이미지로 다시 올려 주세요.");
  }
  return buffer;
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      await mkdir(TESSERACT_CACHE_DIR, { recursive: true });
      const worker = await Tesseract.createWorker(OCR_LANGUAGES, Tesseract.OEM.LSTM_ONLY, {
        cachePath: TESSERACT_CACHE_DIR,
        cacheMethod: "write",
        logger: () => undefined
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        user_defined_dpi: "300"
      });
      return worker;
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function numberTokens(text: string): Array<{ raw: string; value: number; isPercent: boolean; index: number }> {
  const tokens: Array<{ raw: string; value: number; isPercent: boolean; index: number }> = [];
  const regex = /[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|[-+]?\d+(?:\.\d+)?%?/g;
  for (const match of text.matchAll(regex)) {
    const raw = match[0];
    const value = parseOcrNumber(raw);
    if (typeof value === "number" && Number.isFinite(value)) {
      tokens.push({
        raw,
        value,
        isPercent: raw.includes("%") || Math.abs(value) < 100 && /[+-]/.test(raw) && /\.\d/.test(raw),
        index: match.index ?? 0
      });
    }
  }
  return tokens;
}

function parseOcrNumber(raw: string): number | undefined {
  let normalized = raw
    .replace(/[−–—]/g, "-")
    .replace(/[%₩원\s]/g, "")
    .trim();
  if (!normalized) {
    return undefined;
  }

  if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(normalized) && !normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "");
  }

  const value = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function firstNumberAfterLabel(text: string, labels: string[], options: { percent?: boolean } = {}): number | undefined {
  const compact = compactText(text);
  let labelIndex = -1;
  let matchedLabel = "";
  for (const label of labels) {
    const compactLabel = compactText(label);
    const index = compact.indexOf(compactLabel);
    if (index >= 0 && (labelIndex < 0 || index < labelIndex)) {
      labelIndex = index;
      matchedLabel = compactLabel;
    }
  }
  if (labelIndex < 0) {
    return undefined;
  }

  const compactNumbers = numberTokens(compact.slice(labelIndex + matchedLabel.length));
  const found = compactNumbers.find((token) => (options.percent ? token.isPercent : !token.isPercent));
  return found?.value;
}

function extractLabeledNumber(lines: string[], labels: string[], options: { percent?: boolean } = {}): number | undefined {
  for (const line of lines) {
    if (!includesAnyCompact(line, labels)) {
      continue;
    }
    const value = firstNumberAfterLabel(line, labels, options);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function extractLabeledNumberNear(lines: string[], labels: string[], options: { percent?: boolean; lookahead?: number } = {}): number | undefined {
  const direct = extractLabeledNumber(lines, labels, options);
  if (typeof direct === "number") {
    return direct;
  }

  const lookahead = options.lookahead ?? 3;
  for (let index = 0; index < lines.length; index += 1) {
    if (!includesAnyCompact(lines[index], labels)) {
      continue;
    }
    for (let offset = 1; offset <= lookahead && index + offset < lines.length; offset += 1) {
      const token = numberTokens(lines[index + offset]).find((item) => (options.percent ? item.isPercent : !item.isPercent));
      if (token) {
        return token.value;
      }
    }
  }
  return undefined;
}

function extractLikelyTotalInvestedAmount(lines: string[]): number | undefined {
  const direct = extractLabeledNumberNear(lines, ["총매입금액", "총매입", "매입금액합계"], { lookahead: 3 });
  if (typeof direct === "number") {
    return direct;
  }

  const cashIndex = lines.findIndex((line) => includesAnyCompact(line, ["D+2예수금", "0+2예수금"]));
  if (cashIndex < 0) {
    return undefined;
  }

  const candidates = lines
    .slice(cashIndex + 1, cashIndex + 8)
    .flatMap((line) => numberTokens(line).filter((token) => !token.isPercent).map((token) => token.value))
    .filter((value) => value >= 1_000_000);
  return candidates.length ? Math.max(...candidates) : undefined;
}

function cleanName(value: string): string {
  return value
    .replace(/\b[A-Z]?\d{6}\b/g, " ")
    .replace(/[(){}\[\],]/g, " ")
    .replace(/^(국내주식|주식|현금|원화|잔고|보유|종목|명)+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySummaryLine(line: string): boolean {
  return includesAnyCompact(line, summaryLabels) && numberTokens(line).length <= 4;
}

function isLikelyHeaderLine(line: string): boolean {
  return includesAnyCompact(line, headerLabels) && numberTokens(line).length <= 2;
}

function isUiNoiseLine(line: string): boolean {
  const compact = compactText(line);
  if (!compact) {
    return true;
  }
  if (includesAnyCompactIgnoreCase(compact, strongUiNoiseLabels)) {
    return true;
  }
  if (includesAnyCompactIgnoreCase(compact, weakUiNoiseLabels) && (numberTokens(compact).length <= 2 || compact.length <= 16)) {
    return true;
  }
  if (/D\+\d/.test(compact)) {
    return true;
  }
  return false;
}

function isPotentialNameLine(line: string): boolean {
  const cleaned = cleanName(line);
  if (cleaned.length < 2 || cleaned.length > 28) {
    return false;
  }
  if (!/[가-힣A-Za-z]/.test(cleaned)) {
    return false;
  }
  if (isUiNoiseLine(line) || isLikelySummaryLine(line) || isLikelyHeaderLine(line)) {
    return false;
  }
  return numberTokens(line).length <= 1;
}

function inferSymbol(text: string): string | undefined {
  const match = /\b[A-Z]?\d{6}\b/.exec(text);
  return match?.[0];
}

function roundNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value);
}

function firstPriceLike(values: number[]): number | undefined {
  return values.find((value) => value >= 100 && value <= 2_000_000);
}

function parseSingleNumericLine(line: string): { value: number; isPercent: boolean; raw: string } | undefined {
  const tokens = numberTokens(line);
  if (tokens.length !== 1) {
    return undefined;
  }

  const token = tokens[0];
  const leftover = line
    .replace(token.raw, "")
    .replace(/[,%₩원+\-−–—.\s]/g, "")
    .trim();
  if (leftover) {
    return undefined;
  }

  return {
    value: token.value,
    isPercent: token.isPercent || line.includes("%"),
    raw: token.raw
  };
}

function isTableStartLine(line: string): boolean {
  const compact = compactText(line);
  return compact.includes("매도가능") || compact.includes("현재가매도가능");
}

function isTableNameCandidate(line: string): boolean {
  const compact = compactText(line);
  if (!compact || parseSingleNumericLine(line)) {
    return false;
  }
  if (isUiNoiseLine(line) || isLikelySummaryLine(line) || isLikelyHeaderLine(line)) {
    return false;
  }
  return /[A-Za-z가-힣]/.test(line);
}

function normalizeTableName(lines: string[]): string {
  return lines
    .join(" ")
    .replace(/[=~^_]+/g, " ")
    .replace(/[|()[\]{}]/g, " ")
    .replace(/[—–-]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function closeEnough(left: number | undefined, right: number | undefined, tolerance = 0.015): boolean {
  if (typeof left !== "number" || typeof right !== "number" || !Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return false;
  }
  return Math.abs(left - right) / Math.abs(right) <= tolerance;
}

function resolveKnownHolding(draft: PortfolioScreenshotDraftHolding, knownHoldings: PortfolioHolding[]): PortfolioHolding | undefined {
  let best: { holding: PortfolioHolding; score: number } | undefined;
  for (const holding of knownHoldings) {
    let score = 0;
    if (draft.quantity === holding.quantity) score += 3;
    if (closeEnough(draft.avgPrice, holding.avgPrice)) score += 3;
    if (closeEnough(draft.currentPrice, holding.currentPrice)) score += 3;
    if (closeEnough(draft.profitRate, holding.profitRate, 0.08)) score += 1;

    const draftName = compactText(draft.name).toUpperCase();
    const knownName = compactText(holding.name).toUpperCase();
    if (draftName && knownName && (knownName.includes(draftName) || draftName.includes(knownName.slice(0, 2)))) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = { holding, score };
    }
  }
  return best && best.score >= 6 ? best.holding : undefined;
}

function applyKnownHoldingMetadata(draft: PortfolioScreenshotDraftHolding, knownHoldings: PortfolioHolding[]): PortfolioScreenshotDraftHolding {
  const matched = resolveKnownHolding(draft, knownHoldings);
  if (!matched) {
    return draft;
  }
  return {
    ...draft,
    symbol: matched.symbol,
    name: matched.name,
    originalIntent: matched.originalIntent,
    memo: draft.memo ? `${draft.memo}; 기존 보유종목 매칭` : "기존 보유종목 매칭",
    confidence: Math.min(0.96, (draft.confidence ?? 0.82) + 0.08)
  };
}

function buildTableDraft(nameLines: string[], numbers: Array<{ value: number; isPercent: boolean; raw: string }>, knownHoldings: PortfolioHolding[]): PortfolioScreenshotDraftHolding | null {
  if (numbers.length < 7) {
    return null;
  }

  const avgPrice = roundNumber(numbers[1]?.value);
  const quantity = roundNumber(numbers[2]?.value);
  const profitRate = numbers[4]?.value;
  const currentPrice = roundNumber(numbers[5]?.value);
  const sellableQuantity = roundNumber(numbers[6]?.value);
  if (!avgPrice || !quantity || !currentPrice || !Number.isFinite(profitRate)) {
    return null;
  }
  if (avgPrice < 100 || currentPrice < 100 || quantity <= 0) {
    return null;
  }
  if (!numbers[3]?.isPercent || !numbers[4]?.isPercent) {
    return null;
  }

  const draft: PortfolioScreenshotDraftHolding = {
    name: normalizeTableName(nameLines),
    avgPrice,
    currentPrice,
    quantity,
    investedAmount: roundNumber(avgPrice * quantity),
    evaluationAmount: roundNumber(currentPrice * quantity),
    profitRate,
    originalIntent: "UNKNOWN",
    confidence: sellableQuantity === quantity ? 0.88 : 0.82,
    sourceRowText: `${nameLines.join(" ")} ${numbers.map((item) => item.raw).join(" ")}`
  };

  return applyKnownHoldingMetadata(draft, knownHoldings);
}

function parseBrokerBalanceTable(lines: string[], knownHoldings: PortfolioHolding[]): PortfolioScreenshotDraftHolding[] {
  const startIndex = lines.findIndex(isTableStartLine);
  if (startIndex < 0) {
    return [];
  }

  const drafts: PortfolioScreenshotDraftHolding[] = [];
  let index = startIndex + 1;
  while (index < lines.length) {
    while (index < lines.length && !isTableNameCandidate(lines[index])) {
      index += 1;
    }
    if (index >= lines.length) {
      break;
    }

    const nameLines: string[] = [];
    while (index < lines.length && isTableNameCandidate(lines[index]) && nameLines.length < 4) {
      nameLines.push(lines[index]);
      index += 1;
      if (parseSingleNumericLine(lines[index] ?? "")) {
        break;
      }
    }

    const numbers: Array<{ value: number; isPercent: boolean; raw: string }> = [];
    while (index < lines.length && numbers.length < 8) {
      const numeric = parseSingleNumericLine(lines[index]);
      if (numeric) {
        numbers.push(numeric);
        index += 1;
        continue;
      }
      break;
    }

    const draft = buildTableDraft(nameLines, numbers, knownHoldings);
    if (draft) {
      drafts.push(draft);
    }
  }

  return drafts;
}

function inferAmounts(draft: PortfolioScreenshotDraftHolding, rest: number[]): void {
  const avgPrice = Number(draft.avgPrice);
  const currentPrice = Number(draft.currentPrice);
  const quantity = Number(draft.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return;
  }

  if (!Number.isFinite(draft.investedAmount) && Number.isFinite(avgPrice)) {
    const target = avgPrice * quantity;
    draft.investedAmount = roundNumber(rest.find((value) => Math.abs(value - target) / Math.max(target, 1) < 0.18)) ?? roundNumber(target);
  }
  if (!Number.isFinite(draft.evaluationAmount) && Number.isFinite(currentPrice)) {
    const target = currentPrice * quantity;
    draft.evaluationAmount = roundNumber(rest.find((value) => Math.abs(value - target) / Math.max(target, 1) < 0.18)) ?? roundNumber(target);
  }
  if (!Number.isFinite(draft.profitRate) && Number.isFinite(avgPrice) && avgPrice > 0 && Number.isFinite(currentPrice)) {
    draft.profitRate = Math.round(((currentPrice - avgPrice) / avgPrice) * 10_000) / 100;
  }
}

function draftConfidence(draft: PortfolioScreenshotDraftHolding): number {
  const fields = [
    draft.name,
    draft.avgPrice,
    draft.currentPrice,
    draft.quantity,
    draft.investedAmount,
    draft.evaluationAmount,
    draft.profitRate
  ].filter((value) => value !== undefined && value !== null && value !== "").length;
  const base = 0.22 + fields * 0.09;
  const labeledBonus = draft.sourceRowText && includesAnyCompact(draft.sourceRowText, Object.values(fieldLabels).flat()) ? 0.1 : 0;
  return Math.min(0.86, Math.round((base + labeledBonus) * 100) / 100);
}

function parseLabeledBlock(lines: string[], startIndex: number): PortfolioScreenshotDraftHolding | null {
  const name = cleanName(lines[startIndex]);
  if (isUiNoiseLine(lines[startIndex]) || isUiNoiseLine(name)) {
    return null;
  }
  const windowLines = lines.slice(startIndex, startIndex + 12);
  const text = windowLines.join(" ");

  const draft: PortfolioScreenshotDraftHolding = {
    symbol: inferSymbol(text),
    name,
    originalIntent: "UNKNOWN" satisfies OriginalIntent,
    avgPrice: roundNumber(firstNumberAfterLabel(text, fieldLabels.avgPrice)),
    currentPrice: roundNumber(firstNumberAfterLabel(text, fieldLabels.currentPrice)),
    quantity: roundNumber(firstNumberAfterLabel(text, fieldLabels.quantity)),
    investedAmount: roundNumber(firstNumberAfterLabel(text, fieldLabels.investedAmount)),
    evaluationAmount: roundNumber(firstNumberAfterLabel(text, fieldLabels.evaluationAmount)),
    profitRate: firstNumberAfterLabel(text, fieldLabels.profitRate, { percent: true }),
    sourceRowText: text
  };

  const knownFieldCount = [
    draft.avgPrice,
    draft.currentPrice,
    draft.quantity,
    draft.investedAmount,
    draft.evaluationAmount,
    draft.profitRate
  ].filter((value) => Number.isFinite(value)).length;

  if (knownFieldCount < 2) {
    return null;
  }

  inferAmounts(draft, numberTokens(text).map((token) => token.value));
  draft.confidence = draftConfidence(draft);
  return draft;
}

function parseTableRow(line: string): PortfolioScreenshotDraftHolding | null {
  if (isUiNoiseLine(line) || isLikelySummaryLine(line) || isLikelyHeaderLine(line)) {
    return null;
  }

  const tokens = numberTokens(line);
  if (tokens.length < 3 || !/[가-힣A-Za-z]/.test(line)) {
    return null;
  }

  const namePart = cleanName(line.slice(0, tokens[0]?.index ?? 0));
  if (namePart.length < 2 || isUiNoiseLine(namePart)) {
    return null;
  }

  let numeric = tokens.filter((token) => !token.isPercent);
  const symbol = inferSymbol(line);
  if (symbol && numeric[0]?.raw.replace(/\D/g, "") === symbol.replace(/\D/g, "")) {
    numeric = numeric.slice(1);
  }

  const profitToken = tokens.find((token) => token.isPercent);
  const values = numeric.map((token) => token.value);
  const avgPrice = firstPriceLike(values);
  const currentPrice = firstPriceLike(values.slice(avgPrice === undefined ? 0 : 1));
  const priceStart = avgPrice === undefined ? 0 : values.indexOf(avgPrice) + 1;
  const quantity = roundNumber(values.slice(priceStart + (currentPrice === undefined ? 0 : 1)).find((value) => value > 0 && value < 1_000_000));

  const draft: PortfolioScreenshotDraftHolding = {
    symbol,
    name: namePart,
    originalIntent: "UNKNOWN",
    avgPrice: roundNumber(avgPrice),
    currentPrice: roundNumber(currentPrice),
    quantity,
    profitRate: profitToken?.value,
    sourceRowText: line
  };

  inferAmounts(draft, values);
  const knownFieldCount = [draft.avgPrice, draft.currentPrice, draft.quantity, draft.investedAmount, draft.evaluationAmount, draft.profitRate].filter(
    (value) => Number.isFinite(value)
  ).length;
  if (knownFieldCount < 3) {
    return null;
  }
  draft.confidence = draftConfidence(draft);
  return draft;
}

function dedupeDrafts(drafts: PortfolioScreenshotDraftHolding[]): PortfolioScreenshotDraftHolding[] {
  const byKey = new Map<string, PortfolioScreenshotDraftHolding>();
  for (const draft of drafts) {
    const key = `${draft.symbol ?? ""}:${compactText(draft.name)}`;
    const previous = byKey.get(key);
    if (!previous || (draft.confidence ?? 0) > (previous.confidence ?? 0)) {
      byKey.set(key, draft);
    }
  }
  return [...byKey.values()].slice(0, 50);
}

function parseHoldingsFromText(rawText: string, knownHoldings: PortfolioHolding[] = []): PortfolioScreenshotParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const tableDrafts = parseBrokerBalanceTable(lines, knownHoldings);
  const drafts: PortfolioScreenshotDraftHolding[] = [];
  if (tableDrafts.length >= 2) {
    drafts.push(...tableDrafts);
  } else {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const rowDraft = parseTableRow(line);
      if (rowDraft) {
        drafts.push(applyKnownHoldingMetadata(rowDraft, knownHoldings));
        continue;
      }

      if (isPotentialNameLine(line)) {
        const blockDraft = parseLabeledBlock(lines, index);
        if (blockDraft) {
          drafts.push(applyKnownHoldingMetadata(blockDraft, knownHoldings));
        }
      }
    }
  }

  const resultDrafts = dedupeDrafts(drafts);
  const warnings: string[] = [];
  if (!resultDrafts.length) {
    warnings.push("로컬 OCR이 보유 종목 행을 확정하지 못했습니다. 표가 잘 보이도록 확대하거나 GPT 판독을 보조로 사용해 주세요.");
  }
  if (resultDrafts.some((draft) => (draft.confidence ?? 0) < 0.55)) {
    warnings.push("신뢰도가 낮은 행이 있습니다. 저장 전 종목명과 가격, 수량을 확인해 주세요.");
  }
  if (tableDrafts.length >= 2) {
    warnings.push("잔고 표 위치 기반 파서를 적용했습니다. 일부 종목명은 기존 보유 데이터와 가격/수량으로 보정될 수 있습니다.");
  }

  return {
    cashBalance: extractLabeledNumberNear(lines, ["D+2예수금", "0+2예수금", "출금가능"], { lookahead: 3 }),
    totalInvestedAmount: extractLikelyTotalInvestedAmount(lines),
    totalEvaluationAmount: extractLabeledNumberNear(lines, ["총평가금액", "평가금액합계", "평가합계"], { lookahead: 3 }),
    totalProfitRate: extractLabeledNumberNear(lines, ["추정자산", "총수익률", "총손익률"], { percent: true, lookahead: 2 }),
    draftHoldings: resultDrafts,
    warnings,
    rawText
  };
}

export async function parsePortfolioScreenshotWithLocalOcr(imageDataUrl: string): Promise<PortfolioScreenshotParseResult> {
  const image = parseImageDataUrl(imageDataUrl);
  try {
    const worker = await getWorker();
    const result = await worker.recognize(image);
    const knownHoldings = await readPortfolioHoldings().catch(() => []);
    return parseHoldingsFromText(result.data.text, knownHoldings);
  } catch (error) {
    workerPromise = null;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`로컬 OCR 판독에 실패했습니다. 한국어 OCR 데이터 다운로드 또는 이미지 판독 과정에서 문제가 발생했습니다. (${message})`);
  }
}
