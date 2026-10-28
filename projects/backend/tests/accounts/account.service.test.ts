import { describe, expect, it } from "@jest/globals";

import {
  AccountDataIntegrityError,
  AccountNotFoundError,
  AccountService,
} from "../../src/modules/accounts/account.service.js";
import type {
  Account,
  AccountRepository,
  CashBalance,
  Position,
} from "../../src/modules/accounts/account.types.js";
import { SecurityNotFoundError, SecurityService } from "../../src/modules/security-master/security.service.js";
import type { SecurityDetails } from "../../src/modules/security-master/security.types.js";

const activeAccount: Account = { id: "acc-001", status: "ACTIVE" };
const cashBalance: CashBalance = {
  accountId: "acc-001",
  currency: "VND",
  settledCash: 10_000_000n,
  reservedCash: 2_500_000n,
  buyPayable: 1_000_000n,
  blockedCash: 500_000n,
  pendingReceivable: 2_000_000n,
};
const position: Position = {
  accountId: "acc-001",
  securityId: "sec-001",
  symbol: "SIMAAA",
  marketCode: "SIM_EQ_A",
  settledQuantity: 1_000,
  pendingBuyQuantity: 200,
  pendingSellQuantity: 100,
  reservedQuantity: 300,
  blockedQuantity: 50,
};
const tradableSecurity: SecurityDetails = {
  id: "sec-001",
  symbol: "SIMAAA",
  displayName: "Alpha",
  securityType: "STOCK",
  marketCode: "SIM_EQ_A",
  currency: "VND",
  tradingStatus: "TRADABLE",
  bondTerms: null,
};

function createService({
  account = activeAccount,
  balance = cashBalance,
  positions = [position],
  security = tradableSecurity,
}: {
  account?: Account | null;
  balance?: CashBalance | null;
  positions?: Position[];
  security?: SecurityDetails | null;
} = {}): AccountService {
  const repository: AccountRepository = {
    findAccount: async () => account,
    findCashBalance: async () => balance,
    findPositions: async () => positions,
  };
  const securityService = new SecurityService({
    findAll: async () => [],
    findById: async () => security,
  });

  return new AccountService(repository, securityService);
}

describe("AccountService", () => {
  it("returns the documented balance and position availability", async () => {
    const service = createService();

    await expect(service.getBalance("acc-001")).resolves.toMatchObject({
      availableCash: 6_000_000n,
      pendingReceivable: 2_000_000n,
    });
    await expect(service.getPositions("acc-001")).resolves.toEqual([
      expect.objectContaining({ availableQuantity: 550, pendingBuyQuantity: 200 }),
    ]);
  });

  it("checks exact and insufficient BUY cash using bigint multiplication", async () => {
    const service = createService();

    await expect(
      service.checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "BUY",
        orderType: "LO",
        price: 25_000,
        quantity: 240,
      }),
    ).resolves.toMatchObject({
      valid: true,
      requiredCash: 6_000_000n,
      availableCash: 6_000_000n,
    });
    await expect(
      service.checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "BUY",
        orderType: "LO",
        price: 25_000,
        quantity: 241,
      }),
    ).resolves.toMatchObject({
      valid: false,
      reasonCode: "INSUFFICIENT_CASH",
      shortfallCash: 25_000n,
    });
  });

  it("checks exact and insufficient SELL quantity", async () => {
    const service = createService();

    await expect(
      service.checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "SELL",
        orderType: "LO",
        price: 25_000,
        quantity: 550,
      }),
    ).resolves.toMatchObject({ valid: true, availableQuantity: 550 });
    await expect(
      service.checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "SELL",
        orderType: "LO",
        price: 25_000,
        quantity: 551,
      }),
    ).resolves.toMatchObject({
      valid: false,
      reasonCode: "INSUFFICIENT_SECURITIES",
      shortfallQuantity: 1,
    });
  });

  it("returns zero sellable quantity when the account has no position", async () => {
    const service = createService({ positions: [] });

    await expect(
      service.checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "SELL",
        orderType: "LO",
        price: 25_000,
        quantity: 1,
      }),
    ).resolves.toMatchObject({
      valid: false,
      availableQuantity: 0,
      shortfallQuantity: 1,
    });
  });

  it("returns business results for blocked accounts and non-tradable securities", async () => {
    await expect(
      createService({ account: { id: "acc-001", status: "BLOCKED" } }).checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "BUY",
        orderType: "LO",
        price: 25_000,
        quantity: 1,
      }),
    ).resolves.toMatchObject({ reasonCode: "ACCOUNT_NOT_ACTIVE" });
    await expect(
      createService({
        security: { ...tradableSecurity, tradingStatus: "SUSPENDED" },
      }).checkAvailability({
        accountId: "acc-001",
        securityId: "sec-001",
        side: "SELL",
        orderType: "LO",
        price: 25_000,
        quantity: 1,
      }),
    ).resolves.toMatchObject({ reasonCode: "SECURITY_NOT_TRADABLE" });
  });

  it("does not treat a missing account or cash balance as available assets", async () => {
    await expect(createService({ account: null }).getBalance("acc-001")).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    await expect(createService({ balance: null }).getBalance("acc-001")).rejects.toBeInstanceOf(
      AccountDataIntegrityError,
    );
    await expect(
      createService({ security: null }).checkAvailability({
        accountId: "acc-001",
        securityId: "sec-missing",
        side: "BUY",
        orderType: "LO",
        price: 25_000,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(SecurityNotFoundError);
  });
});
