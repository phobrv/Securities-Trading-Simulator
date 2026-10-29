import { describe, expect, it } from "@jest/globals";
import { executionAmounts, reserveAmount } from "../../src/modules/cash/cash.calculator.js";

describe("cash calculations", () => {
  it("converts the limit reservation to the execution payable without double charging", () => {
    expect(reserveAmount("25000", 100)).toBe(2500000n);
    expect(executionAmounts("25000", "24900", 40)).toEqual({
      reserved: 1000000n, payable: 996000n, released: 4000n,
    });
  });

  it("rejects an execution above the limit and amounts outside DECIMAL(20,0)", () => {
    expect(() => executionAmounts("25000", "25100", 40)).toThrow();
    expect(() => reserveAmount("99999999999999999999", 2)).toThrow();
  });
});
