import request from "supertest";
import { describe, expect, it } from "@jest/globals";

import { createApp } from "../../src/app.js";
import { AccountService } from "../../src/modules/accounts/account.service.js";
import type {
  AccountRepository,
  CashBalance,
  Position,
} from "../../src/modules/accounts/account.types.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import type { SecurityDetails } from "../../src/modules/security-master/security.types.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import { createMarketSessionDependencies } from "../test-support/market-session.js";

const cashBalance: CashBalance = {
  accountId: "acc-001",
  currency: "VND",
  settledCash: 10_000_000n,
  reservedCash: 2_500_000n,
  buyPayable: 1_000_000n,
  blockedCash: 500_000n,
  pendingReceivable: 2_000_000n,
};
const positions: Position[] = [
  {
    accountId: "acc-001",
    securityId: "sec-001",
    symbol: "SIMAAA",
    marketCode: "SIM_EQ_A",
    settledQuantity: 1_000,
    pendingBuyQuantity: 200,
    pendingSellQuantity: 100,
    reservedQuantity: 300,
    blockedQuantity: 50,
  },
];
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
];

function createTestApp({
  accountStatus = "ACTIVE",
  balance = cashBalance,
}: {
  accountStatus?: "ACTIVE" | "BLOCKED";
  balance?: CashBalance | null;
} = {}) {
  const securityService = new SecurityService({
    findAll: async () => [],
    findById: async (securityId) =>
      securities.find((security) => security.id === securityId) ?? null,
  });
  const accountRepository: AccountRepository = {
    findAccount: async (accountId) =>
      accountId === "acc-001" ? { id: accountId, status: accountStatus } : null,
    findCashBalance: async () => balance,
    findPositions: async () => positions,
  };

  return createApp({
    systemService: new SystemService({ ping: async () => undefined }),
    securityService,
    marketDataService: new MarketDataService(
      securityService,
      { getQuote: async () => null, saveAndPublish: async () => undefined },
      "2026-10-24",
    ),
    ...createMarketSessionDependencies(securityService),
    accountService: new AccountService(accountRepository, securityService),
  });
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    securityId: "sec-001",
    side: "BUY",
    orderType: "LO",
    price: 25_000,
    quantity: 240,
    ...overrides,
  };
}

describe("account routes", () => {
  it("returns documented balances and aggregated positions", async () => {
    const app = createTestApp();
    const balance = await request(app).get("/api/accounts/acc-001/balances");
    const accountPositions = await request(app).get(
      "/api/accounts/acc-001/positions",
    );

    expect(balance.status).toBe(200);
    expect(balance.body).toEqual({
      data: {
        accountId: "acc-001",
        currency: "VND",
        settledCash: "10000000",
        reservedCash: "2500000",
        buyPayable: "1000000",
        blockedCash: "500000",
        pendingReceivable: "2000000",
        availableCash: "6000000",
        policy: "CASH_ONLY_NO_ADVANCE",
      },
    });
    expect(accountPositions.status).toBe(200);
    expect(accountPositions.body.data).toEqual([
      expect.objectContaining({
        securityId: "sec-001",
        reservedQuantity: 300,
        availableQuantity: 550,
      }),
    ]);
  });

  it("returns 200 for valid and insufficient preview results", async () => {
    const app = createTestApp();
    const validBuy = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview());
    const insufficientBuy = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ quantity: 241 }));
    const validSell = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ side: "SELL", quantity: 550 }));
    const insufficientSell = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ side: "SELL", quantity: 551 }));

    expect(validBuy.body).toEqual({
      data: {
        valid: true,
        scope: "ASSET_AVAILABILITY",
        requiredCash: "6000000",
        availableCash: "6000000",
      },
    });
    expect(insufficientBuy.status).toBe(200);
    expect(insufficientBuy.body.data).toMatchObject({
      valid: false,
      reasonCode: "INSUFFICIENT_CASH",
      shortfallCash: "25000",
    });
    expect(validSell.body.data).toMatchObject({
      valid: true,
      availableQuantity: 550,
    });
    expect(insufficientSell.body.data).toMatchObject({
      valid: false,
      reasonCode: "INSUFFICIENT_SECURITIES",
      shortfallQuantity: 1,
    });
  });

  it("returns business failures without changing the HTTP status", async () => {
    const blocked = await request(createTestApp({ accountStatus: "BLOCKED" }))
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview());
    const suspended = await request(createTestApp())
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ securityId: "sec-002" }));

    expect(blocked.status).toBe(200);
    expect(blocked.body.data).toEqual({
      valid: false,
      scope: "ASSET_AVAILABILITY",
      reasonCode: "ACCOUNT_NOT_ACTIVE",
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.reasonCode).toBe("SECURITY_NOT_TRADABLE");
  });

  it("rejects invalid input and distinguishes missing or inconsistent data", async () => {
    const app = createTestApp();
    const invalid = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ quantity: 1.5 }));
    const missingAccount = await request(app).get(
      "/api/accounts/acc-missing/balances",
    );
    const missingSecurity = await request(app)
      .post("/api/accounts/acc-001/availability-checks")
      .send(preview({ securityId: "sec-missing" }));
    const missingBalance = await request(createTestApp({ balance: null })).get(
      "/api/accounts/acc-001/balances",
    );

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_AVAILABILITY_CHECK_INPUT");
    expect(missingAccount.status).toBe(404);
    expect(missingAccount.body.error.code).toBe("ACCOUNT_NOT_FOUND");
    expect(missingSecurity.status).toBe(404);
    expect(missingSecurity.body.error.code).toBe("SECURITY_NOT_FOUND");
    expect(missingBalance.status).toBe(500);
    expect(missingBalance.body.error.code).toBe("ACCOUNT_DATA_INTEGRITY_ERROR");
  });
});
