import { describe, expect, it } from "@jest/globals";

import {
  AvailabilityCalculationError,
  calculateAvailableCash,
  calculateAvailableQuantity,
} from "../../src/modules/accounts/availability.calculator.js";

describe("availability calculator", () => {
  it("calculates cash availability without including pending receivable", () => {
    expect(
      calculateAvailableCash({
        settledCash: 10_000_000n,
        reservedCash: 2_500_000n,
        buyPayable: 1_000_000n,
        blockedCash: 500_000n,
      }),
    ).toBe(6_000_000n);
  });

  it("calculates sellable quantity without including pending buys", () => {
    expect(
      calculateAvailableQuantity({
        settledQuantity: 1_000,
        pendingSellQuantity: 100,
        reservedQuantity: 300,
        blockedQuantity: 50,
      }),
    ).toBe(550);
  });

  it("preserves bigint precision for large cash balances", () => {
    expect(
      calculateAvailableCash({
        settledCash: 9_007_199_254_740_993_001n,
        reservedCash: 1n,
        buyPayable: 0n,
        blockedCash: 0n,
      }),
    ).toBe(9_007_199_254_740_993_000n);
  });

  it("rejects negative availability instead of clamping it", () => {
    expect(() =>
      calculateAvailableCash({
        settledCash: 100n,
        reservedCash: 101n,
        buyPayable: 0n,
        blockedCash: 0n,
      }),
    ).toThrow(AvailabilityCalculationError);
    expect(() =>
      calculateAvailableQuantity({
        settledQuantity: 100,
        pendingSellQuantity: 101,
        reservedQuantity: 0,
        blockedQuantity: 0,
      }),
    ).toThrow(AvailabilityCalculationError);
  });
});
