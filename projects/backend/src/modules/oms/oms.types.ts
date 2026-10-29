export type OrderStatus = "PENDING_NEW" | "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
export type CancelStatus = "NONE" | "PENDING" | "ACCEPTED" | "REJECTED";

export type OrderInput = {
  accountId: string;
  securityId: string;
  side: "BUY" | "SELL";
  orderType: "LO";
  price: string;
  quantity: number;
};

export type Order = OrderInput & {
  id: string;
  filledQuantity: number;
  remainingQuantity: number;
  canceledQuantity: number;
  status: OrderStatus;
  cancelRequestStatus: CancelStatus;
  version: number;
};

export type OrderEvent =
  | { type: "OrderReceived"; payload: OrderInput }
  | { type: "OrderAccepted"; payload: Record<string, never> }
  | { type: "OrderRejected"; reasonCode: string; payload: { message: string } }
  | { type: "ExecutionReceived"; payload: { executionId: string; quantity: number; price: string } }
  | { type: "CancelRequested"; payload: Record<string, never> }
  | { type: "CancelConfirmed"; payload: Record<string, never> }
  | { type: "CancelRejected"; reasonCode: string; payload: { message: string } };

export type RecordedEvent = {
  id: string;
  orderId: string;
  eventSequence: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  occurredAt: string;
  recordedAt?: string;
  event: OrderEvent;
};

export interface OmsRepository {
  create(order: Order, event: RecordedEvent): Promise<void>;
  find(id: string): Promise<Order | null>;
  events(id: string): Promise<RecordedEvent[] | null>;
  apply(id: string, update: (order: Order) => { order: Order; event: RecordedEvent }): Promise<Order | null>;
}
