import type {
  OrderBook,
  OrderBookLevel,
  OrderBookSnapshot,
  SimulatorOrder,
} from "./matching.types.js";

export function createOrderBook(securityId: string): OrderBook {
  return { securityId, bids: [], asks: [] };
}

export function sortOrderBook(orderBook: OrderBook): void {
  orderBook.bids.sort(
    (left, right) =>
      right.price - left.price ||
      left.arrivalSequence - right.arrivalSequence,
  );
  orderBook.asks.sort(
    (left, right) =>
      left.price - right.price ||
      left.arrivalSequence - right.arrivalSequence,
  );
}

export function toOrderBookSnapshot(orderBook: OrderBook): OrderBookSnapshot {
  return {
    securityId: orderBook.securityId,
    bids: aggregateLevels(orderBook.bids),
    asks: aggregateLevels(orderBook.asks),
  };
}

function aggregateLevels(orders: readonly SimulatorOrder[]): OrderBookLevel[] {
  const levels: OrderBookLevel[] = [];

  for (const order of orders) {
    const currentLevel = levels.at(-1);
    if (currentLevel?.price === order.price) {
      currentLevel.quantity += order.remainingQuantity;
      currentLevel.orderCount += 1;
      continue;
    }

    levels.push({
      price: order.price,
      quantity: order.remainingQuantity,
      orderCount: 1,
    });
  }

  return levels;
}
