export const orderTypes = ["LO", "ATO", "ATC"] as const;
export const orderSides = ["BUY", "SELL"] as const;
export const marketSessionStates = [
  "PRE_OPEN",
  "OPENING_AUCTION",
  "CONTINUOUS",
  "BREAK",
  "CLOSING_AUCTION",
  "CLOSED",
] as const;

export type OrderType = (typeof orderTypes)[number];
export type OrderSide = (typeof orderSides)[number];
export type MarketSessionState = (typeof marketSessionStates)[number];
export type ClockMode = "SYSTEM" | "FIXED";

export type SessionWindow = {
  state: Exclude<MarketSessionState, "PRE_OPEN" | "CLOSED">;
  start: string;
  end: string;
  allowedOrderTypes: readonly OrderType[];
};

export type MarketSessionConfig = {
  marketCode: string;
  timeZone: string;
  workingWeekdays: readonly number[];
  holidays: readonly string[];
  sessions: readonly SessionWindow[];
};

export type MarketSession = {
  marketCode: string;
  tradingDate: string;
  timeZone: string;
  evaluatedAt: string;
  state: MarketSessionState;
  acceptsNewOrders: boolean;
  allowedOrderTypes: readonly OrderType[];
  sessionEndsAt: string | null;
  clockMode: ClockMode;
  simulation: true;
  isTradingDay: boolean;
};

export type SessionOrderValidationRequest = {
  securityId: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
};

export type SessionOrderValidationResult = {
  valid: boolean;
  scope: "SECURITY_AND_SESSION";
  securityId: string;
  marketCode: string;
  sessionState: MarketSessionState;
  evaluatedAt: string;
  reasonCode:
    | "SECURITY_NOT_TRADABLE"
    | "NON_TRADING_DAY"
    | "SESSION_NOT_ACCEPTING_ORDERS"
    | "ORDER_TYPE_NOT_ALLOWED_IN_SESSION"
    | null;
};
