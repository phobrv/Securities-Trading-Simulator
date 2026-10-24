export type PriceLevel = {
  price: number;
  quantity: number;
};

export type QuoteSnapshot = {
  securityId: string;
  tradingDate: string;
  currency: "VND";
  priceUnit: "VND_PER_UNIT";
  referencePrice: number;
  ceilingPrice: number;
  floorPrice: number;
  lastPrice: number | null;
  lastQuantity: number;
  totalVolume: number;
  totalValue: number;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  bestBid: PriceLevel | null;
  bestAsk: PriceLevel | null;
  updatedAt: string;
  source: "SIMULATOR";
};

export type QuoteQueryResult = {
  data: QuoteSnapshot[];
  missingQuoteSecurityIds: string[];
};

export interface QuoteStore {
  getQuote(
    tradingDate: string,
    securityId: string,
  ): Promise<QuoteSnapshot | null>;
  saveAndPublish(quote: QuoteSnapshot): Promise<void>;
}
