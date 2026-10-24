import { describe, expect, it } from "@jest/globals";

import {
  applySimulatedTrade,
  createInitialQuote,
} from "../../src/modules/market-data/price-simulator.js";

describe("Price Simulator", () => {
  it("calculates the documented totals after three deterministic trades", () => {
    const first = applySimulatedTrade(
      createInitialQuote("2026-10-24", "2026-10-24T00:00:00.000Z"),
      { price: 25_000, quantity: 100 },
      "2026-10-24T00:00:02.000Z",
    );
    const second = applySimulatedTrade(
      first,
      { price: 25_100, quantity: 200 },
      "2026-10-24T00:00:04.000Z",
    );
    const third = applySimulatedTrade(
      second,
      { price: 25_200, quantity: 100 },
      "2026-10-24T00:00:06.000Z",
    );

    expect(third).toMatchObject({
      lastPrice: 25_200,
      lastQuantity: 100,
      totalVolume: 400,
      totalValue: 10_040_000,
      openPrice: 25_000,
      highPrice: 25_200,
      lowPrice: 25_000,
    });
  });
});
