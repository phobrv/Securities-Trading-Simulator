import express from "express";
import { jest } from "@jest/globals";
import request from "supertest";
import { calculateMargin } from "../../src/modules/risk/margin.calculator.js";
import { RiskCheckService } from "../../src/modules/risk/risk-check.service.js";
import { createRiskRouter } from "../../src/modules/risk/risk.routes.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import type {
  MarginOrder,
  MarginScenario,
} from "../../src/modules/risk/margin.types.js";

const order: MarginOrder = {
  securityId: "sec-001",
  side: "BUY",
  price: 25000,
  quantity: 200,
};
function scenario(): MarginScenario {
  return {
    policyCode: "SIM_MARGIN_V1",
    policyVersion: 1,
    availableCash: 3000000n,
    accountCreditLimit: 20000000n,
    loanPrincipal: 0n,
    accruedInterest: 0n,
    reservedLoanAmount: 0n,
    positions: [
      {
        securityId: "sec-001",
        settledQuantity: 1000,
        pendingBuyQuantity: 0,
        pendingSellQuantity: 0,
        reservedSellQuantity: 0,
        blockedQuantity: 0,
        marketPrice: "25000",
      },
    ],
    policies: [
      {
        securityId: "sec-001",
        collateralEligible: true,
        collateralPriceCap: 24000n,
        collateralRateBps: 5000,
        purchaseFinancingEligible: true,
        purchaseFinancingRateBps: 5000,
      },
      {
        securityId: "sec-003",
        collateralEligible: false,
        collateralPriceCap: null,
        collateralRateBps: 0,
        purchaseFinancingEligible: false,
        purchaseFinancingRateBps: 0,
      },
    ],
  };
}
const calc = (s: MarginScenario, o = order) =>
  calculateMargin(s, o, "2026-01-01T00:00:00.000Z");

describe("margin calculator", () => {
  test("A and B have different collateral for the same market value", () => {
    const a = scenario();
    const b = scenario();
    b.positions[0]!.securityId = "sec-003";
    expect(calc(a)).toMatchObject({
      decision: "ALLOW",
      grossLoanCapacity: "12000000",
      requiredLoan: "2000000",
      orderFinancingLimit: "2500000",
      collateralBreakdown: [{ valuationPrice: "24000" }],
    });
    expect(calc(b)).toMatchObject({
      decision: "BLOCK",
      grossLoanCapacity: "0",
      reasonCodes: ["INSUFFICIENT_LOAN_HEADROOM"],
    });
  });
  test("debt, interest and reserved loan are deducted exactly once", () => {
    const s = scenario();
    s.loanPrincipal = 4000000n;
    s.accruedInterest = 100000n;
    s.reservedLoanAmount = 1000000n;
    expect(calc(s)).toMatchObject({
      currentExposure: "5100000",
      additionalLoanHeadroom: "6900000",
    });
    s.loanPrincipal = 13000000n;
    expect(calc(s)).toMatchObject({
      decision: "BLOCK",
      additionalLoanHeadroom: "0",
      reasonCodes: expect.arrayContaining(["EXISTING_EXPOSURE_EXCEEDS_LIMIT"]),
    });
  });
  test("order financing is separate from collateral capacity", () => {
    expect(calc(scenario(), { ...order, quantity: 300 })).toMatchObject({
      decision: "BLOCK",
      requiredLoan: "4500000",
      orderFinancingLimit: "3750000",
      reasonCodes: ["ORDER_FINANCING_RATIO_EXCEEDED"],
    });
  });
  test("lower market price, pending buys excluded, other quantities deducted and account limit applied", () => {
    const s = scenario();
    Object.assign(s.positions[0]!, {
      marketPrice: "23000",
      pendingBuyQuantity: 999,
      pendingSellQuantity: 100,
      reservedSellQuantity: 50,
      blockedQuantity: 50,
    });
    s.accountCreditLimit = 1000000n;
    expect(calc(s)).toMatchObject({
      grossLoanCapacity: "9200000",
      effectiveLoanLimit: "1000000",
      collateralBreakdown: [
        { collateralQuantity: 800, valuationPrice: "23000" },
      ],
    });
  });
  test("no loan does not require financeable security", () => {
    expect(
      calc(scenario(), { ...order, securityId: "sec-003", quantity: 100 }),
    ).toMatchObject({ decision: "ALLOW", requiredLoan: "0" });
  });
  test("a loan for a non-financeable security is blocked", () => {
    expect(calc(scenario(), { ...order, securityId: "sec-003" })).toMatchObject(
      {
        decision: "BLOCK",
        reasonCodes: expect.arrayContaining(["SECURITY_NOT_FINANCEABLE"]),
      },
    );
  });
  test("missing policy, price or invalid quantities never allow", () => {
    const s = scenario();
    s.policies = [];
    expect(calc(s)).toMatchObject({
      decision: "UNAVAILABLE",
      grossLoanCapacity: null,
      reasonCodes: ["POLICY_NOT_CONFIGURED"],
    });
    const p = scenario();
    p.positions[0]!.marketPrice = null;
    expect(calc(p)).toMatchObject({
      decision: "UNAVAILABLE",
      effectiveLoanLimit: null,
      reasonCodes: ["MISSING_VALUATION_PRICE"],
    });
    const q = scenario();
    q.positions[0]!.blockedQuantity = 1001;
    expect(calc(q)).toMatchObject({
      decision: "UNAVAILABLE",
      additionalLoanHeadroom: null,
      reasonCodes: ["INVALID_COLLATERAL_QUANTITY"],
    });
  });
  test("rounds each security before adding", () => {
    const s = scenario();
    s.positions = [
      { ...s.positions[0]!, settledQuantity: 1, marketPrice: "1" },
      { ...s.positions[0]!, settledQuantity: 1, marketPrice: "1" },
    ];
    expect(calc(s).grossLoanCapacity).toBe("0");
  });
});

describe("margin simulation API", () => {
  test("repository errors are handled without exposing details", async () => {
    const app = express()
      .use(express.json())
      .use(
        createRiskRouter(
          new RiskCheckService({
            findScenario: async () => {
              throw new Error("secret database detail");
            },
          }),
        ),
      )
      .use(errorHandler);
    const result = await request(app)
      .post("/api/risk/margin-simulations")
      .send({ scenarioId: "scenario-A", order })
      .expect(500);
    expect(JSON.stringify(result.body)).not.toContain("secret database detail");
  });
  test("repeated calls read only and validate requests", async () => {
    const s = scenario();
    const before = structuredClone(s);
    const findScenario = jest.fn(async (id: string) =>
      id === "scenario-A" ? s : null,
    );
    const app = express();
    app.use(express.json());
    app.use(
      createRiskRouter(
        new RiskCheckService(
          { findScenario },
          () => new Date("2026-01-01T00:00:00Z"),
        ),
      ),
    );
    app.use(errorHandler);
    const payload = { scenarioId: "scenario-A", order };
    const first = await request(app)
      .post("/api/risk/margin-simulations")
      .send(payload)
      .expect(200);
    const second = await request(app)
      .post("/api/risk/margin-simulations")
      .send(payload)
      .expect(200);
    expect(first.body).toEqual(second.body);
    expect(first.body.data.decision).toBe("ALLOW");
    expect(s).toEqual(before);
    await request(app)
      .post("/api/risk/margin-simulations")
      .send({ ...payload, order: { ...order, quantity: -1 } })
      .expect(400);
    await request(app)
      .post("/api/risk/margin-simulations")
      .send({ ...payload, scenarioId: "unknown" })
      .expect(404);
  });
});
