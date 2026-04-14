import type { LongTermLiquiditySnapshot } from "../types.js";

type BaseLiquidityFilters = {
  minimumTradableTurnover20: number;
  minimumTradableTurnover60: number;
};

export function passesBaseLiquidityFloor(liquidity: LongTermLiquiditySnapshot, filters: BaseLiquidityFilters) {
  return (
    (liquidity.avgTurnover20 ?? 0) >= filters.minimumTradableTurnover20 ||
    (liquidity.avgTurnover60 ?? 0) >= filters.minimumTradableTurnover60
  );
}
