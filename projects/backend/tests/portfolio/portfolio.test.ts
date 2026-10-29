import { describe, expect, it } from "@jest/globals";
import {
  averageCost,
  buyCost,
  roundHalfUp,
  sellPosition,
} from "../../src/modules/portfolio/cost-basis.calculator.js";
import { PortfolioService } from "../../src/modules/portfolio/portfolio.service.js";
import { MarketDataUnavailableError } from "../../src/modules/market-data/market-data.service.js";
import express from "express";
import request from "supertest";
import { createPortfolioRouter } from "../../src/modules/portfolio/portfolio.routes.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import type {
  AccountRepository,
  Position,
} from "../../src/modules/accounts/account.types.js";
import type { QuoteSnapshot } from "../../src/modules/market-data/market-data.types.js";

const position: Position = {
  accountId: "acc-004",
  securityId: "sec-001",
  symbol: "SIMAAA",
  marketCode: "SIM_EQ_A",
  settledQuantity: 0,
  pendingBuyQuantity: 200,
  pendingSellQuantity: 0,
  reservedQuantity: 0,
  blockedQuantity: 0,
  totalCost: 5200000n,
  realizedPnl: 0n,
};
const quote: QuoteSnapshot = {
  securityId: "sec-001",
  tradingDate: "2026-10-20",
  currency: "VND",
  priceUnit: "VND_PER_UNIT",
  referencePrice: 25000,
  ceilingPrice: 27000,
  floorPrice: 23000,
  lastPrice: 27000,
  lastQuantity: 100,
  totalVolume: 100,
  totalValue: 2700000,
  openPrice: 27000,
  highPrice: 27000,
  lowPrice: 27000,
  bestBid: null,
  bestAsk: null,
  updatedAt: "2026-10-20T03:00:00Z",
  source: "SIMULATOR",
};
function service(p: Position, q: QuoteSnapshot | null = quote) {
  const accounts: AccountRepository = {
    findAccount: async () => ({ id: p.accountId, status: "ACTIVE" }),
    findCashBalance: async () => null,
    findPositions: async () => [p],
  };
  return new PortfolioService(
    accounts,
    {
      getQuotes: async () => ({
        data: q ? [q] : [],
        missingQuoteSecurityIds: [],
      }),
    },
    () => new Date("2026-10-20T03:00:00Z"),
  );
}

describe("cost basis", () => {
  it("uses execution prices and a weighted average", () => {
    const cost = buyCost(buyCost(0n, 25000n, 100), 27000n, 100);
    expect(cost).toBe(5200000n);
    expect(averageCost(cost, 200)).toBe("26000.000000");
    expect(buyCost(0n, 24900n, 100)).toBe(2490000n);
  });
  it("allocates cost and preserves unsettled shares on partial and full sale", () => {
    const settled = {
      ...position,
      settledQuantity: 200,
      pendingBuyQuantity: 0,
      totalCost: 5200000n,
      realizedPnl: 0n,
    };
    const partial = sellPosition(settled, 27000n, 50);
    expect(partial).toMatchObject({
      settledQuantity: 200,
      pendingSellQuantity: 50,
      totalCost: 3900000n,
      realizedPnl: 50000n,
      allocatedCost: 1300000n,
    });
    expect(sellPosition(partial, 27000n, 150)).toMatchObject({
      totalCost: 0n,
      pendingSellQuantity: 200,
      realizedPnl: 200000n,
    });
    expect(() =>
      sellPosition({ ...settled, reservedQuantity: 160 }, 27000n, 50),
    ).toThrow();
  });
  it("rounds using integers and exhausts cost on the final sale", () => {
    expect(roundHalfUp(5n, 2n)).toBe(3n);
    expect(roundHalfUp(4n, 3n)).toBe(1n);
    const first = sellPosition(
      {
        ...position,
        settledQuantity: 3,
        pendingBuyQuantity: 0,
        totalCost: 2n,
        realizedPnl: 0n,
      },
      1n,
      1,
    );
    expect(first.allocatedCost).toBe(1n);
    expect(sellPosition(first, 1n, 2).totalCost).toBe(0n);
  });
});

describe("portfolio valuation", () => {
  it("exposes the portfolio over HTTP with monetary strings", async () => {
    const app = express()
      .use(createPortfolioRouter(service(position)))
      .use(errorHandler);
    const response = await request(app).get("/api/accounts/acc-004/portfolio");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      accountId: "acc-004",
      currency: "VND",
      valuationPolicy: "LAST_TRADED_PRICE",
      positions: [
        {
          marketPrice: "27000",
          marketValue: "5400000",
          unrealizedPnl: "200000",
        },
      ],
    });
  });
  it("values pending shares but does not make them sellable; quote changes do not change cost", async () => {
    const p = (await service(position).getPortfolio("acc-004")).positions[0];
    expect(p).toMatchObject({
      economicQuantity: 200,
      availableQuantity: 0,
      totalCost: "5200000",
      averageCost: "26000.000000",
      marketValue: "5400000",
      unrealizedPnl: "200000",
    });
    const lower = (
      await service(position, { ...quote, lastPrice: 25000 }).getPortfolio(
        "acc-004",
      )
    ).positions[0];
    expect(lower).toMatchObject({
      totalCost: "5200000",
      unrealizedPnl: "-200000",
    });
  });
  it("does not deduct reserved and blocked shares from economic quantity", async () => {
    const p = (
      await service({
        ...position,
        settledQuantity: 200,
        pendingBuyQuantity: 0,
        reservedQuantity: 30,
        blockedQuantity: 20,
      }).getPortfolio("acc-004")
    ).positions[0];
    expect(p).toMatchObject({
      economicQuantity: 200,
      availableQuantity: 150,
      marketValue: "5400000",
    });
  });
  it("reports missing cost, missing quote, old quote, and market-data failure without fake P&L", async () => {
    expect(
      (await service({ ...position, totalCost: null }).getPortfolio("acc-004"))
        .positions[0],
    ).toMatchObject({
      costStatus: "MISSING",
      averageCost: null,
      unrealizedPnl: null,
    });
    expect(
      (await service(position, null).getPortfolio("acc-004")).positions[0],
    ).toMatchObject({
      valuationStatus: "UNAVAILABLE",
      marketPrice: null,
      marketValue: null,
      unrealizedPnl: null,
    });
    expect(
      (
        await service(position, {
          ...quote,
          updatedAt: "2026-10-20T02:00:00Z",
        }).getPortfolio("acc-004")
      ).positions[0].valuationStatus,
    ).toBe("STALE");
    const accounts: AccountRepository = {
      findAccount: async () => ({ id: "acc-004", status: "ACTIVE" }),
      findCashBalance: async () => null,
      findPositions: async () => [position],
    };
    const unavailable = new PortfolioService(accounts, {
      getQuotes: async () => {
        throw new MarketDataUnavailableError();
      },
    });
    expect(
      (await unavailable.getPortfolio("acc-004")).positions[0].unrealizedPnl,
    ).toBeNull();
  });
});
