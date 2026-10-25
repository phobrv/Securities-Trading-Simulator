export type MarketSessionState =
  | "PRE_OPEN"
  | "OPENING_AUCTION"
  | "CONTINUOUS"
  | "BREAK"
  | "CLOSING_AUCTION"
  | "CLOSED";

export type MarketSession = {
  marketCode: string;
  tradingDate: string;
  timeZone: string;
  evaluatedAt: string;
  state: MarketSessionState;
  acceptsNewOrders: boolean;
  allowedOrderTypes: Array<"LO" | "ATO" | "ATC">;
  sessionEndsAt: string | null;
  clockMode: "SYSTEM" | "FIXED";
  simulation: true;
};
