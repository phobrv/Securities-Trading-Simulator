import type { MarketSessionConfig } from "./market-session.types.js";

export const marketSessionConfigs: readonly MarketSessionConfig[] = [
  {
    marketCode: "SIM_EQ_A",
    timeZone: "Asia/Ho_Chi_Minh",
    workingWeekdays: [1, 2, 3, 4, 5],
    holidays: ["2026-10-21"],
    sessions: [
      {
        state: "OPENING_AUCTION",
        start: "09:00:00",
        end: "09:15:00",
        allowedOrderTypes: ["LO", "ATO"],
      },
      {
        state: "CONTINUOUS",
        start: "09:15:00",
        end: "11:30:00",
        allowedOrderTypes: ["LO"],
      },
      {
        state: "BREAK",
        start: "11:30:00",
        end: "13:00:00",
        allowedOrderTypes: [],
      },
      {
        state: "CONTINUOUS",
        start: "13:00:00",
        end: "14:30:00",
        allowedOrderTypes: ["LO"],
      },
      {
        state: "CLOSING_AUCTION",
        start: "14:30:00",
        end: "14:45:00",
        allowedOrderTypes: ["LO", "ATC"],
      },
    ],
  },
];
