import { ApplicationError } from "../../errors/application-error.js";
import type { OrderEvent, OrderInput } from "./oms.types.js";

function invalid(message: string): never {
  throw new ApplicationError(400, "INVALID_OMS_INPUT", message);
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("Payload phải là object JSON.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !keys.includes(key))) invalid("Payload chứa trường không được hỗ trợ.");
  return body;
}

function text(value: unknown, name: string, max = 36): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) return invalid(`${name} không hợp lệ.`);
  return value.trim();
}

function price(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) return invalid("price không hợp lệ.");
  if (typeof value !== "number" && typeof value !== "string") return invalid("price không hợp lệ.");
  const result = String(value);
  if (!/^[1-9]\d{0,19}$/.test(result)) return invalid("price phải là số nguyên dương trong phạm vi DECIMAL(20,0).");
  return result;
}

function quantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > 4_294_967_295) {
    return invalid("quantity phải là số nguyên dương trong phạm vi INT UNSIGNED.");
  }
  return value;
}

export function parseOrder(value: unknown): OrderInput {
  const body = object(value, ["accountId", "securityId", "side", "orderType", "price", "quantity"]);
  if (body.side !== "BUY" && body.side !== "SELL") return invalid("side không hợp lệ.");
  if (body.orderType !== "LO") return invalid("orderType chỉ hỗ trợ LO.");
  return { accountId: text(body.accountId, "accountId"), securityId: text(body.securityId, "securityId"),
    side: body.side, orderType: "LO", price: price(body.price), quantity: quantity(body.quantity) };
}

export function parseEvent(value: unknown): Exclude<OrderEvent, { type: "OrderReceived" }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("Payload phải là object JSON.");
  const type = (value as Record<string, unknown>).type;
  switch (type) {
    case "OrderAccepted":
    case "CancelRequested":
    case "CancelConfirmed":
      object(value, ["type"]);
      return { type, payload: {} };
    case "OrderRejected":
    case "CancelRejected": {
      const body = object(value, ["type", "reasonCode", "message"]);
      return { type, reasonCode: text(body.reasonCode, "reasonCode", 64), payload: { message: text(body.message, "message", 1000) } };
    }
    case "ExecutionReceived": {
      const body = object(value, ["type", "executionId", "quantity", "price"]);
      return { type, payload: { executionId: text(body.executionId, "executionId", 64), quantity: quantity(body.quantity), price: price(body.price) } };
    }
    default: return invalid("Loại sự kiện không hợp lệ.");
  }
}
