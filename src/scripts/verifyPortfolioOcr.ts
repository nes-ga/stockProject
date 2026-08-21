import assert from "node:assert/strict";
import { parsePortfolioOcrText } from "../services/portfolio/localOcrReader.js";
import type { PortfolioHolding } from "../services/portfolio/types.js";

const fixture = `추정자산 실시간 ON
50.825039-2370% A
D+2예수금
12,898,979
총매입금액
49,471,458
종목
평가손익
평균단가
보유수량
손익률
비중
손익률
현재가
매도가능
cers.
-2,452,588
90,701
139
25.48%
-19.44%
73,400
139
름물산
-384,958
4,890
828
8.18%
-9.50%
4,445
828
아모레퍼시픽
195,018
123,929
25
6.26%
6.30%
132,300
25
매도
손실=1.928,999
3.291
2434
-24.07%
2,510
2434
16.19%
5바이오사이...
손실<572,895
44,036
69
6.14%
-18.84%
35,900
69
원티드랩
-6,581,480
5271
3,542
37.74%
-35.24%
3,430
3,542`;

const knownHoldings: PortfolioHolding[] = [
  { id: "000120", symbol: "000120", name: "CJ대한통운", avgPrice: 95_883, currentPrice: 75_500, quantity: 105, originalIntent: "LONG_TERM" },
  { id: "014970", symbol: "014970", name: "삼륭물산", avgPrice: 6_467, currentPrice: 4_725, quantity: 239, originalIntent: "SWING" },
  { id: "090430", symbol: "090430", name: "아모레퍼시픽", avgPrice: 123_929, currentPrice: 125_900, quantity: 25, originalIntent: "LONG_TERM" },
  { id: "095700", symbol: "095700", name: "제넥신", avgPrice: 4_720, currentPrice: 2_410, quantity: 849, originalIntent: "SWING" },
  { id: "302440", symbol: "302440", name: "SK바이오사이언스", avgPrice: 44_036, currentPrice: 38_550, quantity: 69, originalIntent: "LONG_TERM" },
  { id: "376980", symbol: "376980", name: "원티드랩", avgPrice: 5_294, currentPrice: 2_260, quantity: 3_506, originalIntent: "UNKNOWN" }
];

const result = parsePortfolioOcrText(fixture, knownHoldings);
assert.equal(result.draftHoldings.length, 6);
assert.deepEqual(result.draftHoldings.map((holding) => holding.name), [
  "CJ대한통운",
  "삼륭물산",
  "아모레퍼시픽",
  "제넥신",
  "SK바이오사이언스",
  "원티드랩"
]);
assert.equal(result.draftHoldings[3]?.avgPrice, 3_291);
assert.equal(result.draftHoldings[3]?.quantity, 2_434);
assert.equal(result.cashBalance, 12_898_979);
assert.equal(result.totalEvaluationAmount, 37_926_060);
assert.equal(result.totalProfitRate, -23.7);
assert.equal(result.validation?.safeToReplace, false);

const inconsistentTotalResult = parsePortfolioOcrText(`총평가금액\n40,000,000\n${fixture}`, knownHoldings);
assert.equal(inconsistentTotalResult.validation?.safeToReplace, false);
assert.ok((inconsistentTotalResult.validation?.evaluationAmountDifference ?? 0) > 2_000_000);

const accountOnlyResult = parsePortfolioOcrText(`계좌 잔고\n예수금\n12,898,979\n총평가금액\n37,926,060`);
assert.equal(accountOnlyResult.cashBalance, 12_898_979);
assert.equal(accountOnlyResult.totalEvaluationAmount, 37_926_060);

const accountNumberTrapResult = parsePortfolioOcrText(`예수금\n종합위탁 256-270-209 01\n마2예수금\n21,124,176`);
assert.equal(accountNumberTrapResult.cashBalance, 21_124_176);

console.log(JSON.stringify({ ok: true, holdingCount: result.draftHoldings.length, totalEvaluationAmount: result.totalEvaluationAmount }));
