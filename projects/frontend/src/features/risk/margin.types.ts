export type MarginResult = {
  decision: "ALLOW" | "BLOCK" | "UNAVAILABLE";
  policyCode: string;
  policyVersion: number;
  evaluatedAt: string;
  pricingMode: string;
  availableCash: string;
  grossLoanCapacity: string | null;
  accountCreditLimit: string;
  effectiveLoanLimit: string | null;
  currentExposure: string;
  additionalLoanHeadroom: string | null;
  orderValue: string;
  requiredLoan: string;
  orderFinancingLimit: string | null;
  reasonCodes: string[];
  collateralBreakdown: Array<{
    securityId: string;
    eligible: boolean | null;
    collateralQuantity: number | null;
    marketPrice: string | null;
    valuationPrice: string | null;
    recognizedAssetValue: string | null;
    collateralRateBps: number | null;
    loanCapacity: string | null;
  }>;
};
