import {
  createOrderBook,
  sortOrderBook,
  toOrderBookSnapshot,
} from "./order-book.js";
import type {
  Execution,
  OrderBook,
  OrderBookSnapshot,
  SimulatorOrder,
  SubmitOrderInput,
  SubmitOrderResult,
} from "./matching.types.js";

export class MatchingEngine {
  private readonly orderBooks = new Map<string, OrderBook>();
  private readonly executions: Execution[] = [];
  private readonly clientOrderIds = new Set<string>();
  private nextOrderSequence = 1;
  private nextExecutionSequence = 1;

  public hasClientOrderId(clientOrderId: string): boolean {
    return this.clientOrderIds.has(clientOrderId);
  }

  public submitOrder(input: SubmitOrderInput): SubmitOrderResult {
    if (this.hasClientOrderId(input.clientOrderId)) {
      throw new Error("clientOrderId đã được sử dụng.");
    }

    const incoming = this.createOrder(input);
    const orderBook = this.getOrCreateOrderBook(input.securityId);
    const executions = this.match(orderBook, incoming);

    if (incoming.remainingQuantity > 0) {
      const sameSide = incoming.side === "BUY" ? orderBook.bids : orderBook.asks;
      sameSide.push(incoming);
      sortOrderBook(orderBook);
    }

    this.clientOrderIds.add(incoming.clientOrderId);

    return {
      order: cloneOrder(incoming),
      executions: executions.map(cloneExecution),
    };
  }

  public getOrderBook(securityId: string): OrderBookSnapshot {
    const orderBook = this.orderBooks.get(securityId);
    return orderBook
      ? toOrderBookSnapshot(orderBook)
      : { securityId, bids: [], asks: [] };
  }

  public getExecutions(securityId: string): Execution[] {
    return this.executions
      .filter((execution) => execution.securityId === securityId)
      .map(cloneExecution);
  }

  private createOrder(input: SubmitOrderInput): SimulatorOrder {
    return {
      orderId: `sim-ord-${this.nextOrderSequence}`,
      clientOrderId: input.clientOrderId,
      securityId: input.securityId,
      side: input.side,
      orderType: input.orderType,
      price: input.price,
      quantity: input.quantity,
      filledQuantity: 0,
      remainingQuantity: input.quantity,
      arrivalSequence: this.nextOrderSequence++,
      acceptedAt: input.acceptedAt,
      status: "NEW",
    };
  }

  private getOrCreateOrderBook(securityId: string): OrderBook {
    const existing = this.orderBooks.get(securityId);
    if (existing) {
      return existing;
    }

    const orderBook = createOrderBook(securityId);
    this.orderBooks.set(securityId, orderBook);
    return orderBook;
  }

  private match(orderBook: OrderBook, incoming: SimulatorOrder): Execution[] {
    const restingOrders = incoming.side === "BUY" ? orderBook.asks : orderBook.bids;
    const createdExecutions: Execution[] = [];

    while (incoming.remainingQuantity > 0) {
      const resting = restingOrders[0];
      if (!resting || !canMatch(incoming, resting)) {
        break;
      }

      const quantity = Math.min(
        incoming.remainingQuantity,
        resting.remainingQuantity,
      );
      const execution = this.createExecution(incoming, resting, quantity);
      applyFill(incoming, quantity);
      applyFill(resting, quantity);
      createdExecutions.push(execution);
      this.executions.push(execution);

      if (resting.remainingQuantity === 0) {
        restingOrders.shift();
      }
    }

    return createdExecutions;
  }

  private createExecution(
    incoming: SimulatorOrder,
    resting: SimulatorOrder,
    quantity: number,
  ): Execution {
    const buyOrder = incoming.side === "BUY" ? incoming : resting;
    const sellOrder = incoming.side === "SELL" ? incoming : resting;

    return {
      executionId: `sim-exe-${this.nextExecutionSequence++}`,
      securityId: incoming.securityId,
      buyOrderId: buyOrder.orderId,
      sellOrderId: sellOrder.orderId,
      makerOrderId: resting.orderId,
      takerOrderId: incoming.orderId,
      price: resting.price,
      quantity,
      executedAt: incoming.acceptedAt,
    };
  }
}

function canMatch(incoming: SimulatorOrder, resting: SimulatorOrder): boolean {
  return incoming.side === "BUY"
    ? incoming.price >= resting.price
    : incoming.price <= resting.price;
}

function applyFill(order: SimulatorOrder, quantity: number): void {
  order.filledQuantity += quantity;
  order.remainingQuantity -= quantity;
  order.status =
    order.remainingQuantity === 0
      ? "FILLED"
      : order.filledQuantity > 0
        ? "PARTIALLY_FILLED"
        : "NEW";
}

function cloneOrder(order: SimulatorOrder): SimulatorOrder {
  return { ...order };
}

function cloneExecution(execution: Execution): Execution {
  return { ...execution };
}
