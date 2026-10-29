import {
  calculateAvailableQuantity,
  type AvailableQuantityInput,
} from "../accounts/availability.calculator.js";

const MAX_MONEY = 10n ** 20n - 1n;

export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("Invalid division");
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function buyCost(
  totalCost: bigint,
  price: bigint,
  quantity: number,
): bigint {
  validateTrade(price, quantity);
  const result = totalCost + price * BigInt(quantity);
  if (totalCost < 0n || result > MAX_MONEY)
    throw new Error("Cost out of range");
  return result;
}

export function averageCost(
  totalCost: bigint,
  quantity: number,
): string | null {
  if (quantity === 0) return null;
  const scaled = roundHalfUp(totalCost * 1_000_000n, BigInt(quantity));
  return `${scaled / 1_000_000n}.${(scaled % 1_000_000n).toString().padStart(6, "0")}`;
}

export function sellPosition(
  position: AvailableQuantityInput & {
    pendingBuyQuantity: number;
    totalCost: bigint;
    realizedPnl: bigint;
  },
  price: bigint,
  quantity: number,
) {
  validateTrade(price, quantity);
  const economic =
    position.settledQuantity +
    position.pendingBuyQuantity -
    position.pendingSellQuantity;
  if (
    quantity > calculateAvailableQuantity(position) ||
    quantity > economic ||
    position.totalCost < 0n
  )
    throw new Error("Insufficient position");
  const allocated =
    quantity === economic
      ? position.totalCost
      : roundHalfUp(position.totalCost * BigInt(quantity), BigInt(economic));
  const realizedPnl =
    position.realizedPnl + price * BigInt(quantity) - allocated;
  if (realizedPnl > MAX_MONEY || realizedPnl < -MAX_MONEY)
    throw new Error("P&L out of range");
  return {
    ...position,
    pendingSellQuantity: position.pendingSellQuantity + quantity,
    totalCost: position.totalCost - allocated,
    realizedPnl,
    allocatedCost: allocated,
  };
}

function validateTrade(price: bigint, quantity: number): void {
  if (price <= 0n || !Number.isSafeInteger(quantity) || quantity <= 0)
    throw new Error("Invalid trade");
}
