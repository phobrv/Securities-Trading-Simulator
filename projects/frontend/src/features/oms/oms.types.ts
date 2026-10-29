export type OrderStatus = "PENDING_NEW" | "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
export type CancelStatus = "NONE" | "PENDING" | "ACCEPTED" | "REJECTED";

export type OmsOrderInput = {
  accountId: string;
  securityId: string;
  side: "BUY" | "SELL";
  orderType: "LO";
  price: string;
  quantity: number;
};

export type OmsOrder = OmsOrderInput & {
  id: string;
  status: OrderStatus;
  cancelRequestStatus: CancelStatus;
  filledQuantity: number;
  remainingQuantity: number;
  canceledQuantity: number;
  version: number;
};

export type OmsEvent = {
  id: string;
  eventSequence: number;
  eventType: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reasonCode: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  recordedAt: string;
};

export type SimulatedEvent =
  | { type: "OrderAccepted" | "CancelRequested" | "CancelConfirmed" }
  | { type: "OrderRejected" | "CancelRejected"; reasonCode: string; message: string }
  | { type: "ExecutionReceived"; executionId: string; quantity: number; price: string };
