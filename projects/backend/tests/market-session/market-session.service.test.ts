import { describe, expect, it } from "@jest/globals";

import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";

function createService(instant: string): {
  clock: FixedClock;
  service: MarketSessionService;
} {
  const clock = new FixedClock(new Date(instant));
  return {
    clock,
    service: new MarketSessionService(marketSessionConfigs, clock, "FIXED"),
  };
}

describe("MarketSessionService", () => {
  it.each([
    ["2026-10-20T08:59:59.999+07:00", "PRE_OPEN", []],
    ["2026-10-20T09:00:00.000+07:00", "OPENING_AUCTION", ["LO", "ATO"]],
    ["2026-10-20T09:14:59.999+07:00", "OPENING_AUCTION", ["LO", "ATO"]],
    ["2026-10-20T09:15:00.000+07:00", "CONTINUOUS", ["LO"]],
    ["2026-10-20T11:30:00.000+07:00", "BREAK", []],
    ["2026-10-20T13:00:00.000+07:00", "CONTINUOUS", ["LO"]],
    ["2026-10-20T14:30:00.000+07:00", "CLOSING_AUCTION", ["LO", "ATC"]],
    ["2026-10-20T14:45:00.000+07:00", "CLOSED", []],
  ])("evaluates %s as %s", (instant, state, allowedOrderTypes) => {
    const { service } = createService(instant);

    const session = service.getCurrentSession("SIM_EQ_A");

    expect(session.state).toBe(state);
    expect(session.allowedOrderTypes).toEqual(allowedOrderTypes);
  });

  it("gives the same result for equivalent Vietnam and UTC instants", () => {
    const vietnamTime = createService("2026-10-20T09:15:00+07:00");
    const utcTime = createService("2026-10-20T02:15:00Z");

    expect(vietnamTime.service.getCurrentSession("SIM_EQ_A")).toMatchObject({
      state: "CONTINUOUS",
      tradingDate: "2026-10-20",
      evaluatedAt: "2026-10-20T02:15:00.000Z",
    });
    expect(utcTime.service.getCurrentSession("SIM_EQ_A")).toEqual(
      vietnamTime.service.getCurrentSession("SIM_EQ_A"),
    );
  });

  it("closes the market on weekends and configured holidays", () => {
    const saturday = createService("2026-10-24T09:10:00+07:00");
    const holiday = createService("2026-10-21T09:10:00+07:00");

    expect(saturday.service.getCurrentSession("SIM_EQ_A")).toMatchObject({
      state: "CLOSED",
      isTradingDay: false,
      sessionEndsAt: null,
    });
    expect(holiday.service.getCurrentSession("SIM_EQ_A")).toMatchObject({
      state: "CLOSED",
      isTradingDay: false,
    });
  });

  it("updates evaluation when a FixedClock changes without waiting", () => {
    const { clock, service } = createService("2026-10-20T09:14:59.999+07:00");

    expect(service.getCurrentSession("SIM_EQ_A").state).toBe("OPENING_AUCTION");
    clock.set(new Date("2026-10-20T09:15:00.000+07:00"));
    expect(service.getCurrentSession("SIM_EQ_A").state).toBe("CONTINUOUS");
  });
});
