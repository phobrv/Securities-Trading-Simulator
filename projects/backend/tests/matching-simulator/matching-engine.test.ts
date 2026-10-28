import { describe, expect, it } from "@jest/globals";

import { MatchingEngine } from "../../src/modules/matching-simulator/matching-engine.js";
import type {
  SimulatorOrderSide,
  SubmitOrderResult,
} from "../../src/modules/matching-simulator/matching.types.js";

function submit(
  engine: MatchingEngine,
  clientOrderId: string,
  side: SimulatorOrderSide,
  price: number,
  quantity: number,
): SubmitOrderResult {
  return engine.submitOrder({
    clientOrderId,
    securityId: "sec-001",
    side,
    orderType: "LO",
    price,
    quantity,
    acceptedAt: "2026-10-20T03:00:00.000Z",
  });
}

describe("MatchingEngine", () => {
  it("creates multiple executions at resting prices and keeps the remaining ask", () => {
    const engine = new MatchingEngine();
    submit(engine, "S1", "SELL", 24_900, 40);
    submit(engine, "S2", "SELL", 25_000, 100);
    submit(engine, "S3", "SELL", 25_100, 50);

    const result = submit(engine, "B1", "BUY", 25_000, 100);

    expect(result.order).toMatchObject({
      status: "FILLED",
      filledQuantity: 100,
      remainingQuantity: 0,
      arrivalSequence: 4,
    });
    expect(result.executions).toEqual([
      expect.objectContaining({
        buyOrderId: "sim-ord-4",
        sellOrderId: "sim-ord-1",
        makerOrderId: "sim-ord-1",
        price: 24_900,
        quantity: 40,
      }),
      expect.objectContaining({
        buyOrderId: "sim-ord-4",
        sellOrderId: "sim-ord-2",
        makerOrderId: "sim-ord-2",
        price: 25_000,
        quantity: 60,
      }),
    ]);
    expect(
      result.executions.reduce(
        (total, execution) => total + execution.price * execution.quantity,
        0,
      ),
    ).toBe(2_496_000);
    expect(engine.getOrderBook("sec-001")).toEqual({
      securityId: "sec-001",
      bids: [],
      asks: [
        { price: 25_000, quantity: 40, orderCount: 1 },
        { price: 25_100, quantity: 50, orderCount: 1 },
      ],
    });
  });

  it("keeps a partially filled incoming order on the correct side", () => {
    const engine = new MatchingEngine();
    submit(engine, "S1", "SELL", 24_900, 40);
    submit(engine, "S2", "SELL", 25_000, 100);
    submit(engine, "S3", "SELL", 25_100, 50);

    const result = submit(engine, "B2", "BUY", 25_000, 160);

    expect(result.order).toMatchObject({
      status: "PARTIALLY_FILLED",
      filledQuantity: 140,
      remainingQuantity: 20,
    });
    expect(engine.getOrderBook("sec-001")).toEqual({
      securityId: "sec-001",
      bids: [{ price: 25_000, quantity: 20, orderCount: 1 }],
      asks: [{ price: 25_100, quantity: 50, orderCount: 1 }],
    });
  });

  it("prioritizes price then arrival sequence and preserves a resting partial fill", () => {
    const engine = new MatchingEngine();
    submit(engine, "S1", "SELL", 25_000, 100);
    submit(engine, "S2", "SELL", 25_000, 100);
    submit(engine, "S3", "SELL", 24_900, 100);

    const firstBuy = submit(engine, "B1", "BUY", 25_000, 140);
    const secondBuy = submit(engine, "B2", "BUY", 25_000, 100);

    expect(firstBuy.executions.map((execution) => execution.sellOrderId)).toEqual([
      "sim-ord-3",
      "sim-ord-1",
    ]);
    expect(secondBuy.executions.map((execution) => execution.sellOrderId)).toEqual([
      "sim-ord-1",
      "sim-ord-2",
    ]);
    expect(secondBuy.executions.map((execution) => execution.quantity)).toEqual([
      60,
      40,
    ]);
  });

  it("uses a resting buy price when an incoming sell matches", () => {
    const engine = new MatchingEngine();
    submit(engine, "B1", "BUY", 25_000, 100);

    const result = submit(engine, "S1", "SELL", 24_900, 40);

    expect(result.executions).toEqual([
      expect.objectContaining({
        buyOrderId: "sim-ord-1",
        sellOrderId: "sim-ord-2",
        makerOrderId: "sim-ord-1",
        price: 25_000,
        quantity: 40,
      }),
    ]);
    expect(engine.getOrderBook("sec-001").bids).toEqual([
      { price: 25_000, quantity: 60, orderCount: 1 },
    ]);
  });

  it("prioritizes the highest resting bid for an incoming sell", () => {
    const engine = new MatchingEngine();
    submit(engine, "B1", "BUY", 24_900, 100);
    submit(engine, "B2", "BUY", 25_000, 100);

    const result = submit(engine, "S1", "SELL", 24_900, 100);

    expect(result.executions).toEqual([
      expect.objectContaining({
        buyOrderId: "sim-ord-2",
        sellOrderId: "sim-ord-3",
        price: 25_000,
        quantity: 100,
      }),
    ]);
    expect(engine.getOrderBook("sec-001").bids).toEqual([
      { price: 24_900, quantity: 100, orderCount: 1 },
    ]);
  });

  it("does not create executions when prices do not cross", () => {
    const engine = new MatchingEngine();
    submit(engine, "S1", "SELL", 25_100, 100);

    const result = submit(engine, "B1", "BUY", 25_000, 100);

    expect(result.executions).toEqual([]);
    expect(result.order.status).toBe("NEW");
    expect(engine.getOrderBook("sec-001")).toEqual({
      securityId: "sec-001",
      bids: [{ price: 25_000, quantity: 100, orderCount: 1 }],
      asks: [{ price: 25_100, quantity: 100, orderCount: 1 }],
    });
  });
});
