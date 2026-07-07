import { config } from "../../config.js";
import type { PortfolioScreenshotParseResult } from "./types.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_IMAGE_DATA_URL_LENGTH = 18_000_000;

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const directText = (payload as { output_text?: unknown }).output_text;
  if (typeof directText === "string") {
    return directText;
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      const text = (part as { text?: unknown })?.text;
      if (typeof text === "string") {
        chunks.push(text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonFromText(text: string): PortfolioScreenshotParseResult {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
    : trimmed;
  const parsed = JSON.parse(jsonText);
  return {
    brokerName: typeof parsed.brokerName === "string" ? parsed.brokerName : undefined,
    accountLabel: typeof parsed.accountLabel === "string" ? parsed.accountLabel : undefined,
    cashBalance: typeof parsed.cashBalance === "number" ? parsed.cashBalance : undefined,
    totalInvestedAmount: typeof parsed.totalInvestedAmount === "number" ? parsed.totalInvestedAmount : undefined,
    totalEvaluationAmount: typeof parsed.totalEvaluationAmount === "number" ? parsed.totalEvaluationAmount : undefined,
    totalProfitRate: typeof parsed.totalProfitRate === "number" ? parsed.totalProfitRate : undefined,
    draftHoldings: Array.isArray(parsed.draftHoldings)
      ? parsed.draftHoldings
          .filter((item: unknown) => item && typeof item === "object")
          .map((item: Record<string, unknown>) => ({
            symbol: typeof item.symbol === "string" && item.symbol.trim() ? item.symbol.trim() : undefined,
            name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "미확인",
            avgPrice: typeof item.avgPrice === "number" ? item.avgPrice : undefined,
            currentPrice: typeof item.currentPrice === "number" ? item.currentPrice : undefined,
            quantity: typeof item.quantity === "number" ? item.quantity : undefined,
            investedAmount: typeof item.investedAmount === "number" ? item.investedAmount : undefined,
            evaluationAmount: typeof item.evaluationAmount === "number" ? item.evaluationAmount : undefined,
            profitRate: typeof item.profitRate === "number" ? item.profitRate : undefined,
            originalIntent:
              item.originalIntent === "SWING" || item.originalIntent === "LONG_TERM" || item.originalIntent === "UNKNOWN"
                ? item.originalIntent
                : "UNKNOWN",
            memo: typeof item.memo === "string" ? item.memo : undefined,
            confidence: typeof item.confidence === "number" ? item.confidence : undefined,
            sourceRowText: typeof item.sourceRowText === "string" ? item.sourceRowText : undefined
          }))
      : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((item: unknown): item is string => typeof item === "string") : [],
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : undefined
  };
}

export async function parsePortfolioScreenshot(imageDataUrl: string): Promise<PortfolioScreenshotParseResult> {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for portfolio screenshot parsing.");
  }

  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(imageDataUrl)) {
    throw new Error("Only PNG, JPG, JPEG, or WEBP screenshots are supported.");
  }

  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Screenshot is too large. Please upload an image under about 12MB.");
  }

  const prompt = [
    "You are extracting Korean brokerage portfolio holdings from a screenshot.",
    "Return ONLY valid JSON. Do not include markdown.",
    "Different apps use different layouts, but common Korean labels include 보유종목, 종목명, 평균단가, 매입단가, 현재가, 수량, 보유수량, 손익률, 평가손익, 총매입금액, 매입금액, 평가금액, 예수금.",
    "Extract only actual stock holdings. Do not treat summary rows, cash rows, tabs, buttons, or index labels as holdings.",
    "Use numbers only. Remove commas, KRW symbols, percent signs, plus signs, and Korean unit labels. Convert percentages such as -12.34% to -12.34.",
    "If a field is unclear, use null. Do not guess hidden values.",
    "Schema: { brokerName?: string, accountLabel?: string, cashBalance?: number|null, totalInvestedAmount?: number|null, totalEvaluationAmount?: number|null, totalProfitRate?: number|null, draftHoldings: Array<{ symbol?: string|null, name: string, avgPrice?: number|null, currentPrice?: number|null, quantity?: number|null, investedAmount?: number|null, evaluationAmount?: number|null, profitRate?: number|null, originalIntent?: 'UNKNOWN', memo?: string|null, confidence?: number, sourceRowText?: string|null }>, warnings: string[], rawText?: string }"
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify({
      model: config.openaiVisionModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }
      ],
      max_output_tokens: 3000
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : `OpenAI screenshot parsing failed with status ${response.status}.`;
    if (/valid image|image data/i.test(message)) {
      throw new Error("이미지 데이터가 유효한 PNG/JPG/WEBP로 인식되지 않았습니다. 원본 스크린샷을 다시 저장하거나 다른 이미지 형식으로 올려 주세요.");
    }
    throw new Error(message);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI returned an empty screenshot parse result.");
  }

  return parseJsonFromText(outputText);
}
