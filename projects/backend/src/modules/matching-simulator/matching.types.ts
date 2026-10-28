export const simulatorOrderSides = ["BUY", "SELL"] as const;

export type SimulatorOrderSide = (typeof simulatorOrderSides)[number];
export type SimulatorOrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED";

export type SimulatorOrder = {
  orderId: string;
  clientOrderId: string;
  securityId: string;
  side: SimulatorOrderSide;
  orderType: "LO";
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  arrivalSequence: number;
  acceptedAt: string;
  status: SimulatorOrderStatus;
};

export type Execution = {
  executionId: string;
  securityId: string;
  buyOrderId: string;
  sellOrderId: string;
  makerOrderId: string;
  takerOrderId: string;
  price: number;
  quantity: number;
  executedAt: string;
};

export type OrderBook = {
  securityId: string;
  bids: SimulatorOrder[];
  asks: SimulatorOrder[];
};

export type OrderBookLevel = {
  price: number;
  quantity: number;
  orderCount: number;
};

export type OrderBookSnapshot = {
  securityId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
};

export type SubmitOrderInput = {
  clientOrderId: string;
  securityId: string;
  side: SimulatorOrderSide;
  orderType: "LO";
  price: number;
  quantity: number;
  acceptedAt: string;
};

export type SubmitOrderResult = {
  order: SimulatorOrder;
  executions: Execution[];
};
