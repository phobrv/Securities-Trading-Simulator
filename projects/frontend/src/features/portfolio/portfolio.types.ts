export type PortfolioPosition = {
  securityId: string;
  symbol: string;
  economicQuantity: number;
  availableQuantity: number;
  pendingBuyQuantity: number;
  averageCost: string | null;
  marketPrice: string | null;
  unrealizedPnl: string | null;
  costStatus: "KNOWN" | "MISSING";
  valuationStatus: "AVAILABLE" | "UNAVAILABLE" | "STALE";
  quoteUpdatedAt: string | null;
};
export type Portfolio = { accountId: string; positions: PortfolioPosition[] };
