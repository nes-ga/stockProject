import type {
  AiAction,
  CurrentMode,
  PortfolioExecutionPlan,
  PortfolioHolding,
  PortfolioRecoveryBuyStage,
  PortfolioRecoveryPlan,
  PortfolioRecoveryScenario,
  PortfolioRecoverySimulation
} from "./types.js";
import { resolveHoldingInvestedAmount } from "./amounts.js";

const READY_ACTIONS = new Set<AiAction>(["ADD_ALLOWED", "ROTATION_BUY"]);
const REDUCE_ACTIONS = new Set<AiAction>(["REDUCE_ON_REBOUND", "CUT_LOSS"]);
const FINAL_PROFIT_TARGET_RATE = 3;
const FIRST_RECOVERY_RETURN_RATE = 5;
const MAX_REQUIRED_REBOUND_AFTER_BUY = 30;
const MIN_REBOUND_IMPROVEMENT = 0.5;
const RECOVERY_REBOUND_TARGET_RATE = 20;
const STAGE_ALLOCATION_RATES = [0.3, 0.3, 0.4] as const;

export type PortfolioRecoveryBudgetContext = {
  priceSource?: PortfolioRecoveryPlan["priceSource"];
  maxAdditionalBuyAmount?: number;
  budgetAvailable?: boolean;
};

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundAmount(value: number) {
  return Math.round(value);
}

function roundPrice(value: number) {
  return Math.round(value);
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateRequiredReboundRate(breakEvenPrice: number, currentPrice: number) {
  return currentPrice > 0 ? Math.max(0, ((breakEvenPrice - currentPrice) / currentPrice) * 100) : 0;
}

function calculateRequiredAdditionalBuyAmountForTarget(params: {
  currentInvestedAmount: number;
  currentPrice: number;
  currentQuantity: number;
  targetReboundRate: number;
}) {
  const targetRate = params.targetReboundRate / 100;
  if (targetRate <= 0 || params.currentPrice <= 0 || params.currentQuantity <= 0) {
    return undefined;
  }

  const requiredQuantity = Math.ceil(
    Math.max(
      0,
      (params.currentInvestedAmount / params.currentPrice -
        (1 + targetRate) * params.currentQuantity) /
        targetRate
    )
  );
  return requiredQuantity > 0 ? roundAmount(requiredQuantity * params.currentPrice) : undefined;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function simulateRecovery(params: {
  currentPrice: number;
  currentQuantity: number;
  currentInvestedAmount: number;
  requestedAdditionalBuyAmount: number;
  requiredReboundRate: number;
}): PortfolioRecoverySimulation | undefined {
  const additionalBuyQuantity = Math.floor(params.requestedAdditionalBuyAmount / params.currentPrice);
  if (additionalBuyQuantity < 1) {
    return undefined;
  }

  const actualAdditionalBuyAmount = roundAmount(additionalBuyQuantity * params.currentPrice);
  const newQuantity = params.currentQuantity + additionalBuyQuantity;
  const newTotalInvestedAmount = roundAmount(params.currentInvestedAmount + actualAdditionalBuyAmount);
  const newAvgPrice = newTotalInvestedAmount / newQuantity;
  const requiredReboundRateAfterBuy = calculateRequiredReboundRate(newAvgPrice, params.currentPrice);
  const avgPriceReductionRate =
    params.currentInvestedAmount > 0
      ? ((params.currentInvestedAmount / params.currentQuantity - newAvgPrice) /
          (params.currentInvestedAmount / params.currentQuantity)) *
        100
      : 0;
  const currentEvaluationAfterBuy = params.currentPrice * newQuantity;
  const lossAmountAfterBuy = Math.max(0, newTotalInvestedAmount - currentEvaluationAfterBuy);
  const initialFinalRecoveryPrice = newAvgPrice * (1 + FINAL_PROFIT_TARGET_RATE / 100);
  const firstRecoveryPrice = params.currentPrice * (1 + FIRST_RECOVERY_RETURN_RATE / 100);
  const firstRecoverySellQuantity = Math.min(
    additionalBuyQuantity,
    Math.ceil(actualAdditionalBuyAmount / firstRecoveryPrice)
  );
  const firstRecoveryTarget =
    firstRecoveryPrice < initialFinalRecoveryPrice && firstRecoverySellQuantity > 0
      ? {
          price: roundPrice(firstRecoveryPrice),
          sellQuantity: firstRecoverySellQuantity,
          expectedProceeds: roundAmount(firstRecoverySellQuantity * firstRecoveryPrice),
          label: "추가매수금 1차 회수"
        }
      : undefined;
  const remainingQuantityAfterFirstRecovery =
    newQuantity - (firstRecoveryTarget?.sellQuantity ?? 0);
  const targetTotalProceeds =
    newTotalInvestedAmount * (1 + FINAL_PROFIT_TARGET_RATE / 100);
  const finalRecoveryPrice = firstRecoveryTarget
    ? (targetTotalProceeds - firstRecoveryTarget.expectedProceeds) /
      remainingQuantityAfterFirstRecovery
    : initialFinalRecoveryPrice;

  return {
    buyPrice: roundPrice(params.currentPrice),
    requestedAdditionalBuyAmount: roundAmount(params.requestedAdditionalBuyAmount),
    additionalBuyQuantity,
    actualAdditionalBuyAmount,
    newQuantity,
    newTotalInvestedAmount,
    newAvgPrice: roundPrice(newAvgPrice),
    lossAmountAfterBuy: roundAmount(lossAmountAfterBuy),
    requiredReboundRateAfterBuy: roundPercent(requiredReboundRateAfterBuy),
    reboundRateImprovement: roundPercent(params.requiredReboundRate - requiredReboundRateAfterBuy),
    avgPriceReductionRate: roundPercent(Math.max(0, avgPriceReductionRate)),
    firstRecoveryTarget,
    finalRecoveryTarget: {
      price: roundPrice(finalRecoveryPrice),
      sellQuantity: remainingQuantityAfterFirstRecovery,
      label: firstRecoveryTarget
        ? `1차 회수 후 전체 자금 +${FINAL_PROFIT_TARGET_RATE}%`
        : `전체 원금 회복 후 +${FINAL_PROFIT_TARGET_RATE}%`,
      targetProfitRate: FINAL_PROFIT_TARGET_RATE,
      expectedProfitAmount: roundAmount(newTotalInvestedAmount * (FINAL_PROFIT_TARGET_RATE / 100))
    }
  };
}

function buildStagedRecoveryStrategy(params: {
  currentPrice: number;
  currentQuantity: number;
  currentInvestedAmount: number;
  totalBudget: number;
  invalidPrice?: number;
  addPriceZone?: PortfolioExecutionPlan["addPriceZone"];
}): { stages: PortfolioRecoveryBuyStage[]; scenarios: PortfolioRecoveryScenario[] } {
  const lowerZonePrice = Number(params.addPriceZone?.from);
  const upperZonePrice = Number(params.addPriceZone?.to);
  const floorAboveInvalid = isFinitePositive(params.invalidPrice) ? params.invalidPrice * 1.01 : 1;
  const supportPrice = Math.max(
    floorAboveInvalid,
    isFinitePositive(lowerZonePrice)
      ? Math.min(params.currentPrice, lowerZonePrice)
      : params.currentPrice * 0.97
  );
  const confirmationPrice = Math.max(
    params.currentPrice,
    isFinitePositive(upperZonePrice) ? upperZonePrice : params.currentPrice * 1.03
  );
  const stagePrices = [params.currentPrice, supportPrice, confirmationPrice];
  const labels = ["1차 시험 매수", "2차 지지 확인", "3차 회복 확인"];
  const triggers = [
    "현재 회복 신호와 무효가 유효 상태 유지",
    "추가매수 구간 지지와 하락 둔화 재확인",
    "현재가 회복 또는 상단 돌파 확인"
  ];
  const stages: PortfolioRecoveryBuyStage[] = [];
  let cumulativeAdditionalAmount = 0;
  let cumulativeAdditionalQuantity = 0;

  for (let index = 0; index < STAGE_ALLOCATION_RATES.length; index += 1) {
    const allocationRate = STAGE_ALLOCATION_RATES[index];
    const buyPrice = roundPrice(stagePrices[index]);
    const requestedAmount = roundAmount(
      index === STAGE_ALLOCATION_RATES.length - 1
        ? Math.max(0, params.totalBudget - cumulativeAdditionalAmount)
        : params.totalBudget * allocationRate
    );
    const quantity = buyPrice > 0 ? Math.floor(requestedAmount / buyPrice) : 0;
    const actualAmount = quantity * buyPrice;
    cumulativeAdditionalAmount += actualAmount;
    cumulativeAdditionalQuantity += quantity;
    const totalQuantity = params.currentQuantity + cumulativeAdditionalQuantity;
    const totalInvestedAmount = params.currentInvestedAmount + cumulativeAdditionalAmount;
    const newAvgPrice = totalQuantity > 0 ? totalInvestedAmount / totalQuantity : 0;
    const maxLossAtInvalidPrice = isFinitePositive(params.invalidPrice)
      ? Math.max(0, totalInvestedAmount - totalQuantity * params.invalidPrice)
      : undefined;
    stages.push({
      stage: (index + 1) as 1 | 2 | 3,
      label: labels[index],
      trigger: triggers[index],
      buyPrice,
      allocationRate: allocationRate * 100,
      requestedAmount,
      quantity,
      actualAmount,
      cumulativeAdditionalAmount,
      cumulativeQuantity: cumulativeAdditionalQuantity,
      newAvgPrice: roundPrice(newAvgPrice),
      requiredReboundRate: roundPercent(calculateRequiredReboundRate(newAvgPrice, buyPrice)),
      maxLossAtInvalidPrice: maxLossAtInvalidPrice === undefined ? undefined : roundAmount(maxLossAtInvalidPrice)
    });
  }

  const scenarioDefinitions = [
    { key: "NONE" as const, label: "추가매수 안 함", count: 0 },
    { key: "STAGE_1" as const, label: "1차만 실행", count: 1 },
    { key: "STAGE_1_2" as const, label: "2차까지 실행", count: 2 },
    { key: "ALL" as const, label: "전체 계획 실행", count: 3 }
  ];
  const scenarios: PortfolioRecoveryScenario[] = scenarioDefinitions.map((definition) => {
    const lastStage = definition.count ? stages[definition.count - 1] : undefined;
    const additionalAmount = lastStage?.cumulativeAdditionalAmount ?? 0;
    const additionalQuantity = lastStage?.cumulativeQuantity ?? 0;
    const totalQuantity = params.currentQuantity + additionalQuantity;
    const totalInvestedAmount = params.currentInvestedAmount + additionalAmount;
    const newAvgPrice = totalInvestedAmount / totalQuantity;
    const maxLossAtInvalidPrice = isFinitePositive(params.invalidPrice)
      ? Math.max(0, totalInvestedAmount - totalQuantity * params.invalidPrice)
      : undefined;
    return {
      key: definition.key,
      label: definition.label,
      executedStages: definition.count,
      totalAdditionalAmount: additionalAmount,
      totalAdditionalQuantity: additionalQuantity,
      totalQuantity,
      totalInvestedAmount: roundAmount(totalInvestedAmount),
      newAvgPrice: roundPrice(newAvgPrice),
      requiredReboundRate: roundPercent(calculateRequiredReboundRate(newAvgPrice, params.currentPrice)),
      maxLossAtInvalidPrice: maxLossAtInvalidPrice === undefined ? undefined : roundAmount(maxLossAtInvalidPrice)
    };
  });

  return { stages, scenarios };
}

export function buildPortfolioRecoveryPlan(params: {
  holding: PortfolioHolding;
  aiAction: AiAction;
  currentMode: CurrentMode;
  executionPlan?: PortfolioExecutionPlan;
  budget?: PortfolioRecoveryBudgetContext;
}): PortfolioRecoveryPlan {
  const currentPrice = Number(params.holding.currentPrice);
  const currentQuantity = Number(params.holding.quantity);
  const investedAmountResolution = resolveHoldingInvestedAmount(params.holding);
  const currentInvestedAmount = investedAmountResolution.amount;
  const priceSource = params.budget?.priceSource ?? "STORED_FALLBACK";
  const warnings: string[] = [];
  const conditions = unique(params.executionPlan?.conditions ?? []);
  const invalidPrice = isFinitePositive(params.executionPlan?.invalidPrice)
    ? roundPrice(params.executionPlan.invalidPrice)
    : undefined;

  const buildBase = (): Omit<
    PortfolioRecoveryPlan,
    "status" | "blockReasons" | "warnings" | "summary" | "conditions"
  > => {
    const currentEvaluationAmount =
      isFinitePositive(currentPrice) && isFinitePositive(currentQuantity)
        ? roundAmount(currentPrice * currentQuantity)
        : 0;
    const currentProfitAmount = roundAmount(currentEvaluationAmount - currentInvestedAmount);
    const breakEvenPrice =
      isFinitePositive(currentInvestedAmount) && isFinitePositive(currentQuantity)
        ? currentInvestedAmount / currentQuantity
        : 0;
    const requiredAdditionalBuyAmountForTarget =
      isFinitePositive(currentPrice) && isFinitePositive(currentQuantity) && isFinitePositive(currentInvestedAmount)
        ? calculateRequiredAdditionalBuyAmountForTarget({
            currentInvestedAmount,
            currentPrice,
            currentQuantity,
            targetReboundRate: RECOVERY_REBOUND_TARGET_RATE
          })
        : undefined;

    return {
      priceSource,
      calculatedAtPrice: isFinitePositive(currentPrice) ? roundPrice(currentPrice) : 0,
      currentQuantity: isFinitePositive(currentQuantity) ? currentQuantity : 0,
      currentInvestedAmount: isFinitePositive(currentInvestedAmount) ? roundAmount(currentInvestedAmount) : 0,
      currentEvaluationAmount,
      currentProfitAmount,
      currentLossAmount: Math.max(0, -currentProfitAmount),
      breakEvenPrice: roundPrice(breakEvenPrice),
      requiredReboundRate:
        isFinitePositive(breakEvenPrice) && isFinitePositive(currentPrice)
          ? roundPercent(calculateRequiredReboundRate(breakEvenPrice, currentPrice))
          : 0,
      targetRequiredReboundRate: requiredAdditionalBuyAmountForTarget
        ? RECOVERY_REBOUND_TARGET_RATE
        : undefined,
      requiredAdditionalBuyAmountForTarget,
      reduceTarget: params.executionPlan?.reboundReduceZone,
      invalidPrice
    };
  };

  const base = buildBase();

  if (
    !isFinitePositive(currentPrice) ||
    !isFinitePositive(currentQuantity) ||
    !isFinitePositive(currentInvestedAmount) ||
    !isFinitePositive(base.breakEvenPrice)
  ) {
    return {
      ...base,
      status: "NOT_ELIGIBLE",
      blockReasons: ["INVALID_HOLDING"],
      warnings: ["평균단가, 현재가, 수량 또는 매수금액을 확인해 주세요."],
      summary: "보유 정보가 부족해 리커버리 금액을 계산할 수 없습니다.",
      conditions
    };
  }

  if (investedAmountResolution.correctedReportedAmount) {
    warnings.push(
      "입력된 매수금액과 평균단가×수량 차이가 2% 이상이라 평균단가×수량으로 보정했습니다."
    );
  }
  if (priceSource === "STORED_FALLBACK") {
    warnings.push("실시간 시세를 받지 못해 저장된 현재가로 계산했습니다.");
  }

  if (base.currentLossAmount <= 0 || base.requiredReboundRate < 1) {
    return {
      ...base,
      status: "NOT_ELIGIBLE",
      blockReasons: [],
      warnings,
      summary: "현재는 추가 자금으로 평단을 낮출 필요가 없는 상태입니다.",
      conditions
    };
  }

  if (REDUCE_ACTIONS.has(params.aiAction) || params.currentMode === "DEAD_MONEY") {
    return {
      ...base,
      status: "REDUCE_ONLY",
      blockReasons: ["ACTION_NOT_ALLOWED"],
      warnings,
      summary: "추가매수 금액은 0원입니다. 반등 시 원금 노출을 줄이는 대응이 우선입니다.",
      conditions: unique(["추가매수 금지", "반등 구간에서 비중 축소 우선", ...conditions])
    };
  }

  const isConditionalWait = params.aiAction === "ADD_WAIT";
  if (!READY_ACTIONS.has(params.aiAction) && !isConditionalWait) {
    return {
      ...base,
      status: "NOT_ELIGIBLE",
      blockReasons: ["ACTION_NOT_ALLOWED"],
      warnings,
      summary: "현재 행동 규칙에서는 리커버리 추가매수 대상이 아닙니다.",
      conditions: unique(["보유 상태 점검 유지", ...conditions])
    };
  }

  if (priceSource !== "LIVE_QUOTE") {
    return {
      ...base,
      status: "WAIT_SIGNAL",
      blockReasons: ["QUOTE_UNAVAILABLE"],
      warnings,
      summary: "최신 시세를 확인할 수 없어 현재 추가금은 0원입니다. 시세 갱신 후 다시 계산합니다.",
      conditions: unique(["최신 시세 기준일 확인 후 재계산", ...conditions])
    };
  }

  if (isFinitePositive(invalidPrice) && currentPrice <= invalidPrice) {
    return {
      ...base,
      status: "WAIT_SIGNAL",
      blockReasons: ["BELOW_INVALID_PRICE"],
      warnings,
      summary: "무효가를 회복하기 전에는 추가매수 금액을 배정하지 않습니다.",
      conditions: unique(["무효가 회복 전 추가매수 금지", ...conditions])
    };
  }

  const hasUsableAccountBudget =
    params.budget?.budgetAvailable !== false &&
    typeof params.budget?.maxAdditionalBuyAmount === "number" &&
    Number.isFinite(params.budget.maxAdditionalBuyAmount);
  if (!hasUsableAccountBudget) {
    warnings.push("최신 주문가능금액과 추정 총자산을 확인할 수 없어 추가 자금 안전 상한을 계산하지 못했습니다.");
    return {
      ...base,
      status: "WAIT_SIGNAL",
      blockReasons: isConditionalWait
        ? ["ACTION_NOT_ALLOWED", "ACCOUNT_BUDGET_UNAVAILABLE"]
        : ["ACCOUNT_BUDGET_UNAVAILABLE"],
      warnings,
      summary: isConditionalWait
        ? "지금 추가금은 0원입니다. 회복 신호와 최신 계좌 금액을 확인한 뒤 다시 계산합니다."
        : "최신 주문가능금액과 추정 총자산이 없어 현재 추가금은 0원입니다. 계좌 금액 갱신 후 다시 계산합니다.",
      conditions: unique([
        isConditionalWait ? "회복 신호 확인 전 추가매수 금지" : "최신 계좌 금액 갱신",
        ...conditions
      ])
    };
  }

  const suggestedRatio = params.aiAction === "ROTATION_BUY" ? 0.2 : 0.15;
  const maxRatio = params.aiAction === "ROTATION_BUY" ? 0.3 : 0.25;
  const evaluationSuggestedRatio = params.aiAction === "ROTATION_BUY" ? 0.25 : 0.2;
  const evaluationMaxRatio = params.aiAction === "ROTATION_BUY" ? 0.4 : 0.3;
  const exposureSuggestedAmount = Math.min(
    currentInvestedAmount * suggestedRatio,
    base.currentEvaluationAmount * evaluationSuggestedRatio
  );
  let exposureMaxAmount = Math.min(
    currentInvestedAmount * maxRatio,
    base.currentEvaluationAmount * evaluationMaxRatio
  );

  exposureMaxAmount = Math.min(
    exposureMaxAmount,
    Math.max(0, params.budget?.maxAdditionalBuyAmount ?? 0)
  );

  const maxAdditionalBuyQuantity = Math.floor(exposureMaxAmount / currentPrice);
  const maxAdditionalBuyAmount = roundAmount(maxAdditionalBuyQuantity * currentPrice);
  if (maxAdditionalBuyQuantity < 1 || maxAdditionalBuyAmount <= 0) {
    return {
      ...base,
      status: "WAIT_SIGNAL",
      blockReasons: [
        typeof params.budget?.maxAdditionalBuyAmount === "number" ? "POSITION_LIMIT" : "AMOUNT_BELOW_ONE_SHARE"
      ],
      warnings,
      summary: "안전 상한 안에서 1주 이상 살 수 없어 추가매수 금액은 0원입니다.",
      conditions: unique(["추가 자금 투입 없이 회복 신호 확인", ...conditions])
    };
  }

  const suggestedAdditionalBuyQuantity = Math.max(
    1,
    Math.min(maxAdditionalBuyQuantity, Math.floor(exposureSuggestedAmount / currentPrice))
  );
  const suggestedAdditionalBuyAmount = roundAmount(suggestedAdditionalBuyQuantity * currentPrice);
  const simulation = simulateRecovery({
    currentPrice,
    currentQuantity,
    currentInvestedAmount,
    requestedAdditionalBuyAmount: suggestedAdditionalBuyAmount,
    requiredReboundRate: base.requiredReboundRate
  });

  if (!simulation) {
    return {
      ...base,
      status: "WAIT_SIGNAL",
      maxAdditionalBuyAmount,
      blockReasons: ["AMOUNT_BELOW_ONE_SHARE"],
      warnings,
      summary: "예시 추가금으로 1주 이상 살 수 없어 금액을 배정하지 않습니다.",
      conditions: unique(["추가 자금 투입 없이 회복 신호 확인", ...conditions])
    };
  }

  if (
    simulation.reboundRateImprovement < MIN_REBOUND_IMPROVEMENT ||
    simulation.requiredReboundRateAfterBuy > MAX_REQUIRED_REBOUND_AFTER_BUY
  ) {
    const requiredAmount = base.requiredAdditionalBuyAmountForTarget;
    const requiredAmountExceedsSafetyLimit =
      Boolean(requiredAmount) && requiredAmount! > maxAdditionalBuyAmount;
    const riskSummary =
      requiredAmount && base.targetRequiredReboundRate && requiredAmountExceedsSafetyLimit
        ? `본전 반등 부담을 +${base.targetRequiredReboundRate}%까지 낮추려면 약 ${requiredAmount.toLocaleString("ko-KR")}원이 필요하지만 안전 상한 ${maxAdditionalBuyAmount.toLocaleString("ko-KR")}원을 넘습니다.`
        : simulation.reboundRateImprovement < MIN_REBOUND_IMPROVEMENT
          ? `추가 자금 대비 본전 반등 부담 개선 폭이 ${MIN_REBOUND_IMPROVEMENT}%p 미만입니다.`
          : `안전 상한 안에서 추가해도 본전까지 ${simulation.requiredReboundRateAfterBuy.toFixed(2)}% 반등이 필요합니다.`;
    return {
      ...base,
      status: "WAIT_SIGNAL",
      maxAdditionalBuyAmount,
      blockReasons:
        simulation.requiredReboundRateAfterBuy > MAX_REQUIRED_REBOUND_AFTER_BUY
          ? ["LOSS_TOO_DEEP"]
          : ["RISK_LIMIT"],
      warnings,
      summary: `${riskSummary} 지금은 추가금을 투입하지 않습니다.`,
      conditions: unique(["추가매수보다 반등 또는 구조 회복 확인", ...conditions])
    };
  }

  if (isConditionalWait) {
    return {
      ...base,
      status: "WAIT_SIGNAL",
      maxAdditionalBuyAmount,
      blockReasons: ["ACTION_NOT_ALLOWED"],
      warnings,
      summary: "지금 추가금은 0원입니다. 회복 신호 확인 후 최신 시세와 주문가능금액으로 다시 계산합니다.",
      conditions: unique([
        "신호 확인 전 추가매수 금지",
        "조건 충족 후 최신 금액으로 재계산",
        ...conditions
      ])
    };
  }

  const stagedStrategy = buildStagedRecoveryStrategy({
    currentPrice,
    currentQuantity,
    currentInvestedAmount,
    totalBudget: suggestedAdditionalBuyAmount,
    invalidPrice,
    addPriceZone: params.executionPlan?.addPriceZone
  });

  return {
    ...base,
    status: "RECOVERY_READY",
    suggestedAdditionalBuyAmount,
    maxAdditionalBuyAmount,
    simulation,
    buyStages: stagedStrategy.stages,
    scenarios: stagedStrategy.scenarios,
    blockReasons: [],
    warnings,
    summary: `예시 추가금 ${suggestedAdditionalBuyAmount.toLocaleString("ko-KR")}원으로 새 평단과 회수 목표를 계산했습니다.`,
    conditions: unique([
      "예시 추가금은 30% · 30% · 40%로 분할",
      "1차 목표에서 추가매수금부터 회수",
      "무효가 이탈 시 추가매수 중단",
      ...conditions
    ])
  };
}
