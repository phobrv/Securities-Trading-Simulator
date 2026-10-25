import { describe, expect, it } from "@jest/globals";

import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "../../src/modules/market-session/order-session-validator.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import type { SecurityDetails } from "../../src/modules/security-master/security.types.js";
import type { SessionOrderValidationResult } from "../../src/modules/market-session/market-session.types.js";

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

function createValidator(instant: string): OrderSessionValidator {
  const clock = new FixedClock(new Date(instant));
  const securityService = new SecurityService({
    findAll: async () => [],
    findById: async (securityId) =>
      securities.find((security) => security.id === securityId) ?? null,
  });
  const sessionService = new MarketSessionService(
    marketSessionConfigs,
    clock,
    "FIXED",
  );

  return new OrderSessionValidator(securityService, sessionService, clock);
}

describe("OrderSessionValidator", () => {
  const cases: Array<
    [string, "LO" | "ATO" | "ATC", SessionOrderValidationResult["reasonCode"]]
  > = [
    ["2026-10-20T08:59:59.999+07:00", "LO", "SESSION_NOT_ACCEPTING_ORDERS"],
    ["2026-10-20T09:00:00.000+07:00", "ATO", null],
    ["2026-10-20T09:14:59.999+07:00", "ATO", null],
    [
      "2026-10-20T09:15:00.000+07:00",
      "ATO",
      "ORDER_TYPE_NOT_ALLOWED_IN_SESSION",
    ],
    ["2026-10-20T09:15:00.000+07:00", "LO", null],
    ["2026-10-20T11:30:00.000+07:00", "LO", "SESSION_NOT_ACCEPTING_ORDERS"],
    ["2026-10-20T13:00:00.000+07:00", "LO", null],
    [
      "2026-10-20T14:29:59.999+07:00",
      "ATC",
      "ORDER_TYPE_NOT_ALLOWED_IN_SESSION",
    ],
    ["2026-10-20T14:30:00.000+07:00", "ATC", null],
    ["2026-10-20T14:45:00.000+07:00", "ATC", "SESSION_NOT_ACCEPTING_ORDERS"],
  ];

  it.each(cases)(
    "validates %s / %s",
    async (instant, orderType, reasonCode) => {
      const result = await createValidator(instant).validate({
        securityId: "sec-001",
        side: "BUY",
        orderType,
        quantity: 100,
        ...(orderType === "LO" ? { price: 25_000 } : {}),
      });

      expect(result.reasonCode).toBe(reasonCode);
      expect(result.valid).toBe(reasonCode === null);
    },
  );

  it("rejects a non-tradable security before session rules", async () => {
    const result = await createValidator("2026-10-20T09:10:00+07:00").validate({
      securityId: "sec-002",
      side: "BUY",
      orderType: "ATO",
      quantity: 100,
    });

    expect(result).toMatchObject({
      valid: false,
      reasonCode: "SECURITY_NOT_TRADABLE",
    });
  });

  it("reports a non-trading day", async () => {
    const result = await createValidator("2026-10-24T09:10:00+07:00").validate({
      securityId: "sec-001",
      side: "BUY",
      orderType: "LO",
      price: 25_000,
      quantity: 100,
    });

    expect(result.reasonCode).toBe("NON_TRADING_DAY");
  });
});
