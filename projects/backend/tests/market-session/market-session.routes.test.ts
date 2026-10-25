import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "../../src/modules/market-session/order-session-validator.js";
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

function createTestApp(instant = "2026-10-20T02:10:00Z") {
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
  });
}

describe("market session routes", () => {
  it("returns the current session using the configured fixed clock", async () => {
    const response = await request(createTestApp()).get(
      "/api/markets/SIM_EQ_A/session",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        marketCode: "SIM_EQ_A",
        tradingDate: "2026-10-20",
        timeZone: "Asia/Ho_Chi_Minh",
        evaluatedAt: "2026-10-20T02:10:00.000Z",
        state: "OPENING_AUCTION",
        acceptsNewOrders: true,
        allowedOrderTypes: ["LO", "ATO"],
        sessionEndsAt: "2026-10-20T02:15:00.000Z",
        clockMode: "FIXED",
        simulation: true,
      },
    });
  });

  it("returns validation results without creating an order", async () => {
    const response = await request(createTestApp())
      .post("/api/order-validations/session")
      .send({
        securityId: "sec-001",
        side: "BUY",
        orderType: "ATO",
        quantity: 100,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        valid: true,
        scope: "SECURITY_AND_SESSION",
        securityId: "sec-001",
        marketCode: "SIM_EQ_A",
        sessionState: "OPENING_AUCTION",
        evaluatedAt: "2026-10-20T02:10:00.000Z",
        reasonCode: null,
      },
    });
  });

  it("uses documented HTTP statuses for validation, unknown security and missing schedule", async () => {
    const app = createTestApp();
    const missingPrice = await request(app)
      .post("/api/order-validations/session")
      .send({
        securityId: "sec-001",
        side: "BUY",
        orderType: "LO",
        quantity: 100,
      });
    const atoWithPrice = await request(app)
      .post("/api/order-validations/session")
      .send({
        securityId: "sec-001",
        side: "BUY",
        orderType: "ATO",
        price: 25_000,
        quantity: 100,
      });
    const missingSecurity = await request(app)
      .post("/api/order-validations/session")
      .send({
        securityId: "sec-404",
        side: "BUY",
        orderType: "ATO",
        quantity: 100,
      });
    const unconfiguredMarket = await request(app)
      .post("/api/order-validations/session")
      .send({
        securityId: "sec-005",
        side: "BUY",
        orderType: "ATO",
        quantity: 100,
      });

    expect(missingPrice.status).toBe(400);
    expect(atoWithPrice.status).toBe(400);
    expect(missingSecurity.body.error.code).toBe("SECURITY_NOT_FOUND");
    expect(missingSecurity.status).toBe(404);
    expect(unconfiguredMarket.body.error.code).toBe(
      "MARKET_SESSION_NOT_CONFIGURED",
    );
    expect(unconfiguredMarket.status).toBe(422);
  });
});
