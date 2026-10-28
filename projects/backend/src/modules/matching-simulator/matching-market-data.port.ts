import type { OrderBookSnapshot, Execution } from "./matching.types.js";

export type MatchingMarketDataUpdate = {
  securityId: string;
  executions: Execution[];
  orderBook: OrderBookSnapshot;
  updatedAt: string;
};

export interface MatchingMarketDataUpdater {
  applyMatchingUpdate(update: MatchingMarketDataUpdate): Promise<void>;
}
