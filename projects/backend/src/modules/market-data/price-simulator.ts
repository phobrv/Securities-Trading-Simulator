import type { QuoteSnapshot, QuoteStore } from "./market-data.types.js";

type SimulatedTrade = {
  price: number;
  quantity: number;
};

const INITIAL_TRADES: readonly SimulatedTrade[] = [
  { price: 25_000, quantity: 100 },
  { price: 25_100, quantity: 200 },
  { price: 25_200, quantity: 100 },
];

const CONTINUATION_TRADES: readonly SimulatedTrade[] = [
  { price: 25_100, quantity: 150 },
  { price: 25_000, quantity: 200 },
  { price: 24_900, quantity: 100 },
  { price: 25_000, quantity: 250 },
];

export function createInitialQuote(
  tradingDate: string,
  updatedAt: string,
): QuoteSnapshot {
  return {
    securityId: "sec-001",
    tradingDate,
    currency: "VND",
    priceUnit: "VND_PER_UNIT",
    referencePrice: 25_000,
    ceilingPrice: 27_000,
    floorPrice: 23_000,
    lastPrice: null,
    lastQuantity: 0,
    totalVolume: 0,
    totalValue: 0,
    openPrice: null,
    highPrice: null,
    lowPrice: null,
    bestBid: null,
    bestAsk: null,
    updatedAt,
    source: "SIMULATOR",
  };
}

export function applySimulatedTrade(
  previous: QuoteSnapshot,
  trade: SimulatedTrade,
  updatedAt: string,
): QuoteSnapshot {
  return {
    ...previous,
    lastPrice: trade.price,
    lastQuantity: trade.quantity,
    totalVolume: previous.totalVolume + trade.quantity,
    totalValue: previous.totalValue + trade.price * trade.quantity,
    openPrice: previous.openPrice ?? trade.price,
    highPrice:
      previous.highPrice === null
        ? trade.price
        : Math.max(previous.highPrice, trade.price),
    lowPrice:
      previous.lowPrice === null
        ? trade.price
        : Math.min(previous.lowPrice, trade.price),
    bestBid: {
      price: Math.max(previous.floorPrice, trade.price - 100),
      quantity: 500,
    },
    bestAsk: {
      price: Math.min(previous.ceilingPrice, trade.price + 100),
      quantity: 300,
    },
    updatedAt,
  };
}

export class PriceSimulator {
  private snapshot: QuoteSnapshot;
  private tickIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private isPublishing = false;

  public constructor(
    private readonly quoteStore: QuoteStore,
    tradingDate: string,
    private readonly tickIntervalMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.snapshot = createInitialQuote(tradingDate, this.now().toISOString());
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    void this.publishNextTick();
    this.timer = setInterval(
      () => void this.publishNextTick(),
      this.tickIntervalMs,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async publishNextTick(): Promise<void> {
    if (this.isPublishing) {
      return;
    }

    this.isPublishing = true;
    const nextSnapshot = applySimulatedTrade(
      this.snapshot,
      this.getNextTrade(),
      this.now().toISOString(),
    );

    try {
      await this.quoteStore.saveAndPublish(nextSnapshot);
      this.snapshot = nextSnapshot;
      this.tickIndex += 1;
    } catch (error) {
      console.error("Không thể phát tick Market Data.", error);
    } finally {
      this.isPublishing = false;
    }
  }

  private getNextTrade(): SimulatedTrade {
    if (this.tickIndex < INITIAL_TRADES.length) {
      return INITIAL_TRADES[this.tickIndex];
    }

    return CONTINUATION_TRADES[
      (this.tickIndex - INITIAL_TRADES.length) % CONTINUATION_TRADES.length
    ];
  }
}
