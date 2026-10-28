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

export type SimulatorExecution = {
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
