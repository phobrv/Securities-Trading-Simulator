export type Security = {
  id: string;
  symbol: string;
  displayName: string;
  securityType: "STOCK" | "BOND" | "ETF";
  marketCode: string;
  currency: string;
  tradingStatus: "TRADABLE" | "SUSPENDED" | "DELISTED";
};

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
  lastQuantity: number | null;
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

export type QuotesById = Record<string, QuoteSnapshot>;

export type MarketDataConnectionState =
  "connecting" | "connected" | "disconnected" | "unavailable";
