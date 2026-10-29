export type MarginPosition = {
  securityId: string;
  settledQuantity: number;
  pendingBuyQuantity: number;
  pendingSellQuantity: number;
  reservedSellQuantity: number;
  blockedQuantity: number;
  marketPrice: string | null;
};

export type SecurityPolicy = {
  securityId: string;
  collateralEligible: boolean;
  collateralPriceCap: bigint | null;
  collateralRateBps: number;
  purchaseFinancingEligible: boolean;
  purchaseFinancingRateBps: number;
};

export type MarginScenario = {
  policyCode: string;
  policyVersion: number;
  availableCash: bigint;
  accountCreditLimit: bigint;
  loanPrincipal: bigint;
  accruedInterest: bigint;
  reservedLoanAmount: bigint;
  positions: MarginPosition[];
  policies: SecurityPolicy[];
};

export type MarginOrder = {
  securityId: string;
  side: "BUY";
  price: number;
  quantity: number;
};
export type ReasonCode =
  | "INSUFFICIENT_LOAN_HEADROOM"
  | "ORDER_FINANCING_RATIO_EXCEEDED"
  | "SECURITY_NOT_FINANCEABLE"
  | "EXISTING_EXPOSURE_EXCEEDS_LIMIT"
  | "POLICY_NOT_CONFIGURED"
  | "MISSING_VALUATION_PRICE"
  | "INVALID_COLLATERAL_QUANTITY";

export interface MarginRepository {
  findScenario(id: string): Promise<MarginScenario | null>;
}
