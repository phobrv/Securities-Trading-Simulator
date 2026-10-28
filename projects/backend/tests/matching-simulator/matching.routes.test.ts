import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "../../src/modules/market-session/order-session-validator.js";
import { MatchingEngine } from "../../src/modules/matching-simulator/matching-engine.js";
import { MatchingService } from "../../src/modules/matching-simulator/matching.service.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import type { SecurityDetails } from "../../src/modules/security-master/security.types.js";

const securities: SecurityDetails[] = [
  {
    id: "sec-001",
    symbol: "SIMAAA",
    displayName: "Alpha",
    securityType: "STOCK",
    marketCode: "SIM_EQ_A",
    currency: "VND",
    tradingStatus: "TRADABLE",
    bondTerms: null,
  },
  {
    id: "sec-002",
    symbol: "SIMBBB",
    displayName: "Beta",
    securityType: "STOCK",
    marketCode: "SIM_EQ_A",
    currency: "VND",
    tradingStatus: "SUSPENDED",
    bondTerms: null,
  },
  {
    id: "sec-005",
    symbol: "SIMCCC",
    displayName: "Gamma",
    securityType: "STOCK",
    marketCode: "SIM_EQ_B",
    currency: "VND",
    tradingStatus: "TRADABLE",
    bondTerms: null,
  },
];

function createTestApp(instant = "2026-10-20T02:15:00Z") {
  const securityService = new SecurityService({
    findAll: async () => [],
    findById: async (securityId) =>
      securities.find((security) => security.id === securityId) ?? null,
  });
  const clock = new FixedClock(new Date(instant));
  const marketSessionService = new MarketSessionService(
    marketSessionConfigs,
    clock,
    "FIXED",
  );

  return createApp({
    systemService: new SystemService({ ping: async () => undefined }),
    securityService,
    marketDataService: new MarketDataService(
      securityService,
      { getQuote: async () => null, saveAndPublish: async () => undefined },
      "2026-10-20",
    ),
    marketSessionService,
    orderSessionValidator: new OrderSessionValidator(
      securityService,
      marketSessionService,
      clock,
    ),
    matchingService: new MatchingService(
      new MatchingEngine(),
      securityService,
      marketSessionService,
      clock,
    ),
  });
}

function order(
  clientOrderId: string,
  side: "BUY" | "SELL",
  price: number,
  quantity: number,
) {
  return {
    clientOrderId,
    securityId: "sec-001",
    side,
    orderType: "LO",
    price,
    quantity,
  };
}

describe("matching simulator routes", () => {
  it("submits orders, returns executions, and exposes aggregate order-book depth", async () => {
    const app = createTestApp();
    await request(app).post("/api/simulator/orders").send(order("S1", "SELL", 24_900, 40));
    await request(app).post("/api/simulator/orders").send(order("S2", "SELL", 25_000, 100));
    await request(app).post("/api/simulator/orders").send(order("S3", "SELL", 25_100, 50));

    const match = await request(app)
      .post("/api/simulator/orders")
      .send(order("B1", "BUY", 25_000, 100));
    const orderBook = await request(app).get("/api/simulator/order-books/sec-001");
    const executions = await request(app).get(
      "/api/simulator/executions?securityId=sec-001",
    );

    expect(match.status).toBe(201);
    expect(match.body.data.order).toMatchObject({
      clientOrderId: "B1",
      status: "FILLED",
      remainingQuantity: 0,
    });
    expect(match.body.data.executions).toEqual([
      expect.objectContaining({ price: 24_900, quantity: 40 }),
      expect.objectContaining({ price: 25_000, quantity: 60 }),
    ]);
    expect(orderBook.body).toEqual({
      data: {
        securityId: "sec-001",
        bids: [],
        asks: [
          { price: 25_000, quantity: 40, orderCount: 1 },
          { price: 25_100, quantity: 50, orderCount: 1 },
        ],
      },
    });
    expect(executions.body.data).toHaveLength(2);
    expect(executions.body.data.map((execution: { quantity: number }) => execution.quantity)).toEqual([40, 60]);
  });

  it("rejects invalid requests before changing the order book", async () => {
    const app = createTestApp();
    const invalidInput = await request(app).post("/api/simulator/orders").send({
      ...order("bad", "BUY", 25_000, 100),
      quantity: 1.5,
    });
    const unsupportedType = await request(app).post("/api/simulator/orders").send({
      ...order("ato", "BUY", 25_000, 100),
      orderType: "ATO",
    });
    const suspended = await request(app).post("/api/simulator/orders").send({
      ...order("suspended", "BUY", 25_000, 100),
      securityId: "sec-002",
    });
    const unsupportedSecurity = await request(app).post("/api/simulator/orders").send({
      ...order("other", "BUY", 25_000, 100),
      securityId: "sec-005",
    });
    const accepted = await request(app)
      .post("/api/simulator/orders")
      .send(order("B1", "BUY", 25_000, 100));
    const duplicate = await request(app)
      .post("/api/simulator/orders")
      .send(order("B1", "BUY", 25_000, 100));
    const orderBook = await request(app).get("/api/simulator/order-books/sec-001");

    expect(invalidInput.body.error.code).toBe("INVALID_ORDER_INPUT");
    expect(invalidInput.status).toBe(400);
    expect(unsupportedType.body.error.code).toBe("UNSUPPORTED_ORDER_TYPE");
    expect(unsupportedType.status).toBe(400);
    expect(suspended.body.error.code).toBe("SECURITY_NOT_TRADABLE");
    expect(suspended.status).toBe(422);
    expect(unsupportedSecurity.body.error.code).toBe("SECURITY_NOT_SUPPORTED");
    expect(unsupportedSecurity.status).toBe(422);
    expect(accepted.status).toBe(201);
    expect(duplicate.body.error.code).toBe("DUPLICATE_CLIENT_ORDER_ID");
    expect(duplicate.status).toBe(409);
    expect(orderBook.body.data.bids).toEqual([
      { price: 25_000, quantity: 100, orderCount: 1 },
    ]);
  });

  it("rejects matching outside the continuous session", async () => {
    const response = await request(createTestApp("2026-10-20T02:10:00Z"))
      .post("/api/simulator/orders")
      .send(order("B1", "BUY", 25_000, 100));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("MATCHING_SESSION_NOT_SUPPORTED");
  });
});
