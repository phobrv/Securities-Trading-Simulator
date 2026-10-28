export const accountStatuses = ["ACTIVE", "BLOCKED"] as const;
export const availabilitySides = ["BUY", "SELL"] as const;

export type AccountStatus = (typeof accountStatuses)[number];
export type AvailabilitySide = (typeof availabilitySides)[number];

export type Account = {
  id: string;
  status: AccountStatus;
};

export type CashBalance = {
  accountId: string;
  currency: "VND";
  settledCash: bigint;
  reservedCash: bigint;
  buyPayable: bigint;
  blockedCash: bigint;
  pendingReceivable: bigint;
};

export type Position = {
  accountId: string;
  securityId: string;
  symbol: string;
  marketCode: string;
  settledQuantity: number;
  pendingBuyQuantity: number;
  pendingSellQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
};

export interface AccountRepository {
  findAccount(accountId: string): Promise<Account | null>;
  findCashBalance(accountId: string): Promise<CashBalance | null>;
  findPositions(accountId: string): Promise<Position[]>;
}

export type AvailabilityCheckRequest = {
  accountId: string;
  securityId: string;
  side: AvailabilitySide;
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
  requiredCash?: bigint;
  availableCash?: bigint;
  shortfallCash?: bigint;
  requiredQuantity?: number;
  availableQuantity?: number;
  shortfallQuantity?: number;
};
