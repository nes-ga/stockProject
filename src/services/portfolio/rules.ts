import type { ServerLongTermPick } from "../serverLongTermPicks.js";
import { buildPortfolioRecoveryPlan, type PortfolioRecoveryBudgetContext } from "./recovery.js";
import type {
  AiAction,
  CurrentMode,
  OriginalIntent,
  PortfolioAdvice,
  PortfolioExecutionPlan,
  PortfolioHolding,
  PortfolioLinkedHistory,
  SuggestedIntent
} from "./types.js";

type SwingHistoryCase = {
  id?: string;
  lifecycleStatus?: string;
  status?: string;
  initialStopLossPrice?: number;
  buyPlan?: {
    stopLossPrice?: number;
  };
  historyOutcome?: {
    outcome?: string;
    category?: string;
  };
  outcome?: string;
};

export type PortfolioRuleContext = {
  swingCase?: SwingHistoryCase;
  longTermPick?: ServerLongTermPick;
  linkedHistory?: PortfolioLinkedHistory;
  recoveryBudget?: PortfolioRecoveryBudgetContext;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function isLossOutcome(swingCase?: SwingHistoryCase) {
  const outcome = swingCase?.historyOutcome?.outcome ?? swingCase?.outcome ?? "";
  const category = swingCase?.historyOutcome?.category ?? "";
  return (
    category === "loss" ||
    /stop|loss|invalid|failed|danger|timeout|broken|market_shock/i.test(outcome)
  );
}

function hasCurrentSwingCase(swingCase?: SwingHistoryCase) {
  return swingCase?.lifecycleStatus === "current" || swingCase?.status === "active";
}

function buildPriority(params: {
  currentMode: CurrentMode;
  aiAction: AiAction;
  originalIntent: OriginalIntent;
  linkedHistory?: PortfolioLinkedHistory;
  executionPlan?: PortfolioExecutionPlan;
}) {
  let score = 30;

  if (params.aiAction === "ADD_ALLOWED") score += 35;
  if (params.aiAction === "ROTATION_BUY") score += 30;
  if (params.aiAction === "REDUCE_ON_REBOUND") score += 25;
  if (params.currentMode === "SWING_BROKEN" && params.originalIntent === "SWING") score += 25;
  if (params.currentMode === "HOLDING_RECOVERY_CANDIDATE") score += 20;
  if (params.linkedHistory?.source === "swing_history") score += 10;
  if (params.executionPlan?.invalidPrice) score += 10;

  if (params.currentMode === "DEAD_MONEY") score -= 35;
  if (params.aiAction === "NO_ACTION") score -= 20;
  if (!params.executionPlan?.invalidPrice) score -= 10;

  return clamp(Math.round(score), 0, 100);
}

function buildConfidence(params: {
  holding: PortfolioHolding;
  linkedHistory?: PortfolioLinkedHistory;
  longTermPick?: ServerLongTermPick;
  executionPlan?: PortfolioExecutionPlan;
}) {
  let score = 20;

  if (params.linkedHistory?.source === "swing_history") score += 20;
  if (Number.isFinite(params.holding.currentPrice) && params.holding.currentPrice > 0) score += 20;
  if (params.longTermPick || params.linkedHistory?.source === "swing_history") score += 20;
  if (params.executionPlan?.invalidPrice || params.executionPlan?.watchPriceZone || params.executionPlan?.addPriceZone || params.executionPlan?.reboundReduceZone) score += 15;
  if (params.holding.originalIntent !== "UNKNOWN") score += 10;
  if (!Number.isFinite(params.holding.avgPrice) || params.holding.avgPrice <= 0 || params.holding.quantity <= 0) score -= 15;

  return clamp(Math.round(score), 0, 100);
}

function priorityLabel(priority: number): "HIGH" | "MEDIUM" | "LOW" {
  if (priority >= 70) return "HIGH";
  if (priority >= 40) return "MEDIUM";
  return "LOW";
}

function resolveFixedInvalidPrice(holding: PortfolioHolding, context: PortfolioRuleContext) {
  const avgBasedSafetyFloor = roundPrice(holding.avgPrice * 0.7);
  const isDirectlyLinked =
    Boolean(holding.sourceRecommendationId) &&
    context.swingCase?.id === holding.sourceRecommendationId;
  const canTrustLinkedStop =
    isDirectlyLinked || hasCurrentSwingCase(context.swingCase);
  const linkedStopPrice =
    context.swingCase?.buyPlan?.stopLossPrice ??
    context.swingCase?.initialStopLossPrice;
  if (
    canTrustLinkedStop &&
    Number.isFinite(linkedStopPrice) &&
    Number(linkedStopPrice) > 0
  ) {
    return {
      price: roundPrice(
        Math.max(Number(linkedStopPrice), Number(avgBasedSafetyFloor ?? 0))
      ),
      condition: "직접 연결된 손절가와 보유 평단 70% 중 높은 가격을 고정 추가금 금지선으로 사용"
    };
  }

  return {
    price: avgBasedSafetyFloor,
    condition: "직접 연결된 손절가가 없어 보유 평단의 70%를 고정 추가금 금지선으로 사용"
  };
}

function buildExecutionPlan(
  holding: PortfolioHolding,
  aiAction: AiAction,
  currentMode: CurrentMode,
  context: PortfolioRuleContext
): PortfolioExecutionPlan | undefined {
  const current = holding.currentPrice;
  const avg = holding.avgPrice;
  const conditions: string[] = [];

  if (!Number.isFinite(current) || current <= 0) {
    return undefined;
  }

  const invalid = resolveFixedInvalidPrice(holding, context);
  conditions.push(invalid.condition);

  if (aiAction === "ROTATION_BUY" || aiAction === "ADD_ALLOWED") {
    conditions.push("지지권 이탈 없이 거래량 회복 확인");
    conditions.push("추가매수분은 반등 시 별도 회수 계획 유지");
    return {
      watchPrice: roundPrice(current),
      addPriceZone: {
        from: roundPrice(current * 0.97),
        to: roundPrice(current * 1.01)
      },
      reboundReduceZone: {
        from: roundPrice(avg * 0.99),
        to: roundPrice(avg * 1.03)
      },
      invalidPrice: invalid.price,
      conditions,
      summary: "현재가 주변 지지 확인 후 추가분만 회전매수로 관리"
    };
  }

  if (aiAction === "ADD_WAIT") {
    conditions.push("즉시 추가매수 금지");
    conditions.push("표시 가격대는 매수 권고가 아니라 지지와 회복 신호 확인 구간");
    conditions.push("지지 재확인 또는 20일선 회복 이후 재검토");
    return {
      watchPrice: roundPrice(current),
      watchPriceZone: {
        from: roundPrice(current * 0.94),
        to: roundPrice(current * 0.99)
      },
      invalidPrice: invalid.price,
      conditions,
      summary: currentMode === "SWING_BROKEN" ? "스윙 훼손 상태라 복구 신호 전까지 추가매수 대기" : "추가매수 조건 확인 전까지 대기"
    };
  }

  if (aiAction === "REDUCE_ON_REBOUND") {
    conditions.push("반등 시 비중 축소 우선");
    conditions.push("추가매수는 신규 회복 조건 확인 전까지 보류");
    return {
      watchPrice: roundPrice(current),
      reboundReduceZone: {
        from: roundPrice(current * 1.08),
        to: roundPrice(avg * 0.98)
      },
      invalidPrice: invalid.price,
      conditions,
      summary: "추가 대응보다 반등 시 노출 축소가 우선"
    };
  }

  if (aiAction === "CUT_LOSS") {
    conditions.push("손실 확대 방지 우선");
    return {
      watchPrice: roundPrice(current),
      invalidPrice: invalid.price,
      conditions,
      summary: "무효 조건이 이미 훼손되어 손실 확정 검토"
    };
  }

  return {
    watchPrice: roundPrice(current),
    invalidPrice: invalid.price,
    conditions: ["신규 행동보다 관찰 유지"],
    summary: "보유 상태 점검 유지"
  };
}

export function evaluatePortfolioHolding(holding: PortfolioHolding, context: PortfolioRuleContext = {}): PortfolioAdvice {
  const profitRate = holding.profitRate ?? 0;
  const reasons: string[] = [];
  const risks: string[] = [];
  let currentMode: CurrentMode = "UNKNOWN";
  let suggestedIntent: SuggestedIntent = "UNKNOWN";
  let aiAction: AiAction = "WATCH";
  let warning: string | undefined;

  if (profitRate <= -60 && !hasCurrentSwingCase(context.swingCase)) {
    currentMode = "DEAD_MONEY";
    suggestedIntent = "NO_EDGE";
    aiAction = "NO_ACTION";
    reasons.push("손실률이 과도하고 현재 연결된 실행 히스토리가 약합니다.");
    risks.push("회복 시나리오 없이 추가매수하면 자금이 장기간 묶일 수 있습니다.");
  } else if (holding.originalIntent === "SWING") {
    suggestedIntent = "SWING";
    if (isLossOutcome(context.swingCase) || profitRate <= -15) {
      currentMode = "SWING_BROKEN";
      suggestedIntent = "RECOVERY";
      aiAction = profitRate <= -35 ? "REDUCE_ON_REBOUND" : "ADD_WAIT";
      warning = "원래는 스윙 진입이지만 현재는 스윙 조건이 훼손되어 보유 복구 관점으로 재분류됩니다.";
      reasons.push("스윙 손절/훼손 조건에 가까운 상태입니다.");
      risks.push("기존 스윙 매수 논리로 추가매수를 진행하면 리스크가 커질 수 있습니다.");
    } else if (profitRate <= -7) {
      currentMode = "SWING_DAMAGED";
      suggestedIntent = "RECOVERY";
      aiAction = "ADD_WAIT";
      warning = "원래는 스윙 진입이지만 현재는 조건 약화 구간이라 추가매수는 대기합니다.";
      reasons.push("손실률이 스윙 허용 범위를 넘어가기 시작했습니다.");
    } else {
      currentMode = "SWING_VALID";
      aiAction = "HOLD";
      reasons.push("손실률이 제한적이고 스윙 보유 맥락이 유지됩니다.");
    }
  } else if (holding.originalIntent === "LONG_TERM") {
    suggestedIntent = "LONG_TERM";
    if (context.longTermPick?.longTermBucket === "buy" && profitRate <= -3) {
      currentMode = "LONG_TERM_VALID";
      aiAction = "ROTATION_BUY";
      reasons.push("중장기 서버 픽에서 본격매수 후보로 유지됩니다.");
      reasons.push("추가매수분 회수 계획이 있으면 회전매수 후보로 볼 수 있습니다.");
    } else if (context.longTermPick?.longTermBucket === "accumulate") {
      currentMode = "LONG_TERM_VALID";
      aiAction = "ADD_ALLOWED";
      reasons.push("중장기 서버 픽에서 분할매수 후보로 유지됩니다.");
    } else if (profitRate <= -25) {
      currentMode = "LONG_TERM_WEAKENED";
      aiAction = "ADD_WAIT";
      reasons.push("장기 보유 의도는 있으나 현재 가격 훼손이 커서 추가매수 대기입니다.");
      risks.push("장기 thesis가 약해진 상태에서 평단 낮추기만 반복할 수 있습니다.");
    } else {
      currentMode = "LONG_TERM_VALID";
      aiAction = "HOLD";
      reasons.push("장기 보유 관점에서 즉시 행동보다 유지/관찰이 우선입니다.");
    }
  } else {
    currentMode = profitRate <= -20 ? "HOLDING_RECOVERY_CANDIDATE" : "UNKNOWN";
    suggestedIntent = profitRate <= -20 ? "RECOVERY" : "UNKNOWN";
    aiAction = profitRate <= -20 ? "ADD_WAIT" : "WATCH";
    reasons.push("원래 매수 목적이 없어 현재 손익과 연결 히스토리 기준으로만 판단합니다.");
    risks.push("originalIntent가 없어 판단 신뢰도가 낮습니다.");
  }

  if (currentMode !== "DEAD_MONEY" && profitRate <= -30 && aiAction === "HOLD") {
    currentMode = "HOLDING_RECOVERY_CANDIDATE";
    suggestedIntent = "RECOVERY";
    aiAction = "ADD_WAIT";
    reasons.push("손실률이 커 보유 복구 관점의 재평가가 필요합니다.");
  }

  const executionPlan = buildExecutionPlan(holding, aiAction, currentMode, context);
  const recoveryPlan = buildPortfolioRecoveryPlan({
    holding,
    aiAction,
    currentMode,
    executionPlan,
    budget: context.recoveryBudget
  });
  const priority = buildPriority({
    currentMode,
    aiAction,
    originalIntent: holding.originalIntent,
    linkedHistory: context.linkedHistory,
    executionPlan
  });
  const confidence = buildConfidence({
    holding,
    linkedHistory: context.linkedHistory,
    longTermPick: context.longTermPick,
    executionPlan
  });

  const summary =
    aiAction === "ROTATION_BUY"
      ? "장기 보유 관점은 유지하되 추가매수분은 반등 시 회수하는 회전매수 후보입니다."
      : aiAction === "ADD_ALLOWED"
        ? "조건부 추가매수가 가능한 상태입니다. 무효 조건을 먼저 고정해야 합니다."
        : aiAction === "ADD_WAIT"
          ? "즉시 추가매수보다 지지와 거래 회복을 기다리는 상태입니다."
          : aiAction === "REDUCE_ON_REBOUND"
            ? "추가 대응보다 반등 시 비중 축소가 우선입니다."
            : aiAction === "NO_ACTION"
              ? "지금 대응 실익이 낮아 우선순위를 낮춥니다."
              : "보유 상태를 유지하며 관찰합니다.";

  return {
    symbol: holding.symbol,
    name: holding.name,
    originalIntent: holding.originalIntent,
    suggestedIntent,
    currentMode,
    aiAction,
    priority,
    priorityLabel: priorityLabel(priority),
    confidence,
    summary,
    warning,
    reasons: [...new Set(reasons)],
    risks: [...new Set(risks)],
    executionPlan,
    recoveryPlan,
    linkedHistory: context.linkedHistory,
    questions: holding.originalIntent === "UNKNOWN" ? ["처음 매수 목적이 스윙인지 중장기인지 확인이 필요합니다."] : undefined,
    holding
  };
}
