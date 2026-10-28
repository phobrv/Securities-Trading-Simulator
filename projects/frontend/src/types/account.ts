export type AccountBalance = {
  accountId: string;
  currency: "VND";
  settledCash: string;
  reservedCash: string;
  buyPayable: string;
  blockedCash: string;
  pendingReceivable: string;
  availableCash: string;
  policy: "CASH_ONLY_NO_ADVANCE";
};

export type AccountPosition = {
  securityId: string;
  symbol: string;
  marketCode: string;
  settledQuantity: number;
  pendingBuyQuantity: number;
  pendingSellQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
  availableQuantity: number;
};

export type AvailabilityCheckRequest = {
  securityId: string;
  side: "BUY" | "SELL";
  orderType: "LO";
  price: number;
  quantity: number;
};

export type AvailabilityCheckResult = {
  valid: boolean;
  scope: "ASSET_AVAILABILITY";
  reasonCode?:
    | "INSUFFICIENT_CASH"
    | "INSUFFICIENT_SECURITIES"
    | "ACCOUNT_NOT_ACTIVE"
    | "SECURITY_NOT_TRADABLE";
  requiredCash?: string;
  availableCash?: string;
  shortfallCash?: string;
  requiredQuantity?: number;
  availableQuantity?: number;
  shortfallQuantity?: number;
};
