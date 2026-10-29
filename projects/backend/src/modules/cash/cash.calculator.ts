import { ApplicationError } from "../../errors/application-error.js";

const maxMoney = 10n ** 20n - 1n;

export function reserveAmount(price: string, quantity: number): bigint {
  const result = BigInt(price) * BigInt(quantity);
  if (result <= 0n || result > maxMoney) {
    throw new ApplicationError(422, "INVALID_CASH_AMOUNT", "Số tiền vượt phạm vi cho phép.");
  }
  return result;
}

export function executionAmounts(limit: string, price: string, quantity: number) {
  const reserved = reserveAmount(limit, quantity);
  const payable = reserveAmount(price, quantity);
  if (payable > reserved) {
    throw new ApplicationError(409, "ORDER_EVENT_CONFLICT", "Giá khớp vượt giá giới hạn.");
  }
  return { reserved, payable, released: reserved - payable };
}
