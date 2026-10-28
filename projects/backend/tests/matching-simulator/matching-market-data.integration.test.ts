import { describe, expect, it } from "@jest/globals";

import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";
import type { QuoteSnapshot, QuoteStore } from "../../src/modules/market-data/market-data.types.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { MatchingEngine } from "../../src/modules/matching-simulator/matching-engine.js";
import { MatchingService } from "../../src/modules/matching-simulator/matching.service.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";

class InMemoryQuoteStore implements QuoteStore {
  private quote: QuoteSnapshot | null = null;

  public async getQuote(): Promise<QuoteSnapshot | null> {
    return this.quote;
  }

  public async saveAndPublish(quote: QuoteSnapshot): Promise<void> {
    this.quote = quote;
  }
}

describe("matching market-data integration", () => {
  it("derives the documented quote snapshot from the completed order book", async () => {
    const clock = new FixedClock(new Date("2026-10-20T03:00:00Z"));
    const securityService = new SecurityService({
      findAll: async () => [],
      findById: async (id) =>
        id === "sec-001"
          ? {
              id,
              symbol: "SIMAAA",
              displayName: "Alpha",
              securityType: "STOCK",
              marketCode: "SIM_EQ_A",
              currency: "VND",
              tradingStatus: "TRADABLE",
              bondTerms: null,
            }
          : null,
    });
    const sessions = new MarketSessionService(marketSessionConfigs, clock, "FIXED");
    const store = new InMemoryQuoteStore();
    const marketData = new MarketDataService(securityService, store, "2026-10-20");
    await marketData.initializeSimulatorQuote("sec-001", clock.now().toISOString());
    const matching = new MatchingService(
      new MatchingEngine(),
      securityService,
      sessions,
      clock,
      marketData,
    );

    await matching.submitOrder(order("S1", "SELL", 24_900, 40));
    await matching.submitOrder(order("S2", "SELL", 25_000, 100));
    await matching.submitOrder(order("S3", "SELL", 25_100, 50));
    const restingQuote = (await marketData.getQuotes(["sec-001"])).data[0];
    const result = await matching.submitOrder(order("B1", "BUY", 25_000, 100));
    const quote = (await marketData.getQuotes(["sec-001"])).data[0];

    expect(restingQuote).toMatchObject({
      lastPrice: null,
      lastQuantity: null,
      totalVolume: 0,
      totalValue: 0,
      bestBid: null,
      bestAsk: { price: 24_900, quantity: 40 },
    });
    expect(result.executions).toHaveLength(2);
    expect(quote).toMatchObject({
      lastPrice: 25_000,
      lastQuantity: 60,
      totalVolume: 100,
      totalValue: 2_496_000,
      openPrice: 24_900,
      highPrice: 25_000,
      lowPrice: 24_900,
      bestBid: null,
      bestAsk: { price: 25_000, quantity: 40 },
    });
  });
});

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
    orderType: "LO" as const,
    price,
    quantity,
  };
}
