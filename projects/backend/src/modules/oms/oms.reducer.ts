import { ApplicationError } from "../../errors/application-error.js";
import type { Order, OrderEvent } from "./oms.types.js";

function conflict(): never {
  throw new ApplicationError(409, "ORDER_EVENT_CONFLICT", "Sự kiện không phù hợp với trạng thái lệnh.");
}

export function applyOrderEvent(order: Order | null, event: OrderEvent, orderId: string): Order {
  if (event.type === "OrderReceived") {
    if (order) conflict();
    return { ...event.payload, id: orderId, filledQuantity: 0, remainingQuantity: event.payload.quantity,
      canceledQuantity: 0, status: "PENDING_NEW", cancelRequestStatus: "NONE", version: 1 };
  }
  if (!order) return conflict();
  const next = { ...order, version: order.version + 1 };
  const active = order.status === "NEW" || order.status === "PARTIALLY_FILLED";
  switch (event.type) {
    case "OrderAccepted":
      if (order.status !== "PENDING_NEW") conflict();
      next.status = "NEW";
      break;
    case "OrderRejected":
      if (order.status !== "PENDING_NEW") conflict();
      next.status = "REJECTED";
      next.remainingQuantity = 0;
      break;
    case "ExecutionReceived": {
      const { quantity, price } = event.payload;
      if (!active || !Number.isInteger(quantity) || quantity <= 0 || quantity > order.remainingQuantity ||
          !/^[1-9]\d{0,19}$/.test(price) ||
          (order.side === "BUY" ? BigInt(price) > BigInt(order.price) : BigInt(price) < BigInt(order.price))) conflict();
      next.filledQuantity += quantity;
      next.remainingQuantity -= quantity;
      next.status = next.remainingQuantity === 0 ? "FILLED" : "PARTIALLY_FILLED";
      break;
    }
    case "CancelRequested":
      if (!active || order.cancelRequestStatus === "PENDING") conflict();
      next.cancelRequestStatus = "PENDING";
      break;
    case "CancelConfirmed":
      if (!active || order.cancelRequestStatus !== "PENDING") conflict();
      next.canceledQuantity = order.remainingQuantity;
      next.remainingQuantity = 0;
      next.status = "CANCELED";
      next.cancelRequestStatus = "ACCEPTED";
      break;
    case "CancelRejected":
      if ((!active && order.status !== "FILLED") || order.cancelRequestStatus !== "PENDING") conflict();
      next.cancelRequestStatus = "REJECTED";
      break;
  }
  return next;
}
