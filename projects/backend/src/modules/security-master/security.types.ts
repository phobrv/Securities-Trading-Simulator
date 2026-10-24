export const securityTypes = ["STOCK", "BOND", "ETF"] as const;
export const tradingStatuses = ["TRADABLE", "SUSPENDED", "DELISTED"] as const;

export type SecurityType = (typeof securityTypes)[number];
export type TradingStatus = (typeof tradingStatuses)[number];

export type Security = {
  id: string;
  symbol: string;
  displayName: string;
  securityType: SecurityType;
  marketCode: string;
  currency: string;
  tradingStatus: TradingStatus;
};

export type BondTerms = {
  faceValue: string;
  couponRateBps: number;
  issueDate: string;
  maturityDate: string;
};

export type SecurityDetails = Security & {
  bondTerms: BondTerms | null;
};

export type SecurityFilters = {
  type?: SecurityType;
  status?: TradingStatus;
  marketCode?: string;
  symbol?: string;
};

export interface SecurityRepository {
  findAll(filters: SecurityFilters): Promise<Security[]>;
  findById(securityId: string): Promise<SecurityDetails | null>;
}
