import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";
import type {
  QuoteSnapshot,
  QuoteStore,
} from "../../src/modules/market-data/market-data.types.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import type { SecurityRepository } from "../../src/modules/security-master/security.types.js";
import { createMarketSessionDependencies } from "../test-support/market-session.js";

const quote: QuoteSnapshot = {
  securityId: "sec-001",
  tradingDate: "2026-10-24",
  currency: "VND",
  priceUnit: "VND_PER_UNIT",
  referencePrice: 25_000,
  ceilingPrice: 27_000,
  floorPrice: 23_000,
  lastPrice: 25_200,
  lastQuantity: 100,
  totalVolume: 400,
  totalValue: 10_040_000,
  openPrice: 25_000,
  highPrice: 25_200,
  lowPrice: 25_000,
  bestBid: { price: 25_100, quantity: 500 },
  bestAsk: { price: 25_300, quantity: 300 },
  updatedAt: "2026-10-24T07:00:06.000Z",
  source: "SIMULATOR",
};

function createTestApp(quoteStore: QuoteStore) {
  const securityService = new SecurityService(createSecurityRepository());

  return createApp({
    systemService: new SystemService({ ping: async () => undefined }),
    securityService,
    marketDataService: new MarketDataService(
      securityService,
      quoteStore,
      "2026-10-24",
    ),
    ...createMarketSessionDependencies(securityService),
  });
}

function createSecurityRepository(): SecurityRepository {
  return {
    findAll: async () => [],
    findById: async (securityId) =>
      securityId === "sec-001"
        ? {
            id: "sec-001",
            symbol: "SIMAAA",
            displayName: "Alpha",
            securityType: "STOCK",
            marketCode: "SIM_EQ_A",
            currency: "VND",
            tradingStatus: "TRADABLE",
            bondTerms: null,
          }
        : securityId === "sec-003"
          ? {
              id: "sec-003",
              symbol: "SIMETF",
              displayName: "ETF",
              securityType: "ETF",
              marketCode: "SIM_FUND",
              currency: "VND",
              tradingStatus: "TRADABLE",
              bondTerms: null,
            }
          : null,
  };
}

describe("market data routes", () => {
  it("returns current snapshots and identifies existing securities without a quote", async () => {
    const response = await request(
      createTestApp({
        getQuote: async (_tradingDate, securityId) =>
          securityId === "sec-001" ? quote : null,
        saveAndPublish: async () => undefined,
      }),
    ).get("/api/market-data/quotes?securityIds=sec-001,sec-003");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [quote],
      missingQuoteSecurityIds: ["sec-003"],
    });
  });

  it("rejects malformed and unknown security IDs", async () => {
    const app = createTestApp({
      getQuote: async () => null,
      saveAndPublish: async () => undefined,
    });

    const malformedResponse = await request(app).get("/api/market-data/quotes");
    const unknownResponse = await request(app).get(
      "/api/market-data/quotes?securityIds=sec-404",
    );

    expect(malformedResponse.status).toBe(400);
    expect(malformedResponse.body.error.code).toBe("INVALID_QUOTE_QUERY");
    expect(unknownResponse.status).toBe(400);
    expect(unknownResponse.body.error.code).toBe("INVALID_SECURITY_IDS");
  });

  it("returns 503 when quote storage is unavailable", async () => {
    const response = await request(
      createTestApp({
        getQuote: async () => {
          throw new Error("Redis is unavailable");
        },
        saveAndPublish: async () => undefined,
      }),
    ).get("/api/market-data/quotes?securityIds=sec-001");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("MARKET_DATA_UNAVAILABLE");
  });
});
