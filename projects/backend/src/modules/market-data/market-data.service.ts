import { ApplicationError } from "../../errors/application-error.js";
import {
  SecurityNotFoundError,
  type SecurityService,
} from "../security-master/security.service.js";

import type {
  QuoteQueryResult,
  QuoteSnapshot,
  QuoteStore,
} from "./market-data.types.js";
import type { MatchingMarketDataUpdate } from "../matching-simulator/matching-market-data.port.js";

const SIMULATOR_REFERENCE_PRICE = 25_000;
const SIMULATOR_CEILING_PRICE = 27_000;
const SIMULATOR_FLOOR_PRICE = 23_000;

export class MarketDataService {
  public constructor(
    private readonly securityService: SecurityService,
    private readonly quoteStore: QuoteStore,
    private readonly tradingDate: string,
  ) {}

  public async getQuotes(securityIds: string[]): Promise<QuoteQueryResult> {
    await this.assertSecurityIdsExist(securityIds);

    try {
      const quotes = await Promise.all(
        securityIds.map((securityId) =>
          this.quoteStore.getQuote(this.tradingDate, securityId),
        ),
      );

      return splitQuotesByAvailability(securityIds, quotes);
    } catch (error) {
      if (error instanceof MarketDataUnavailableError) {
        throw error;
      }

      throw new MarketDataUnavailableError();
    }
  }

  public async initializeSimulatorQuote(
    securityId: string,
    updatedAt: string,
  ): Promise<void> {
    await this.quoteStore.saveAndPublish(
      createSimulatorQuote(this.tradingDate, securityId, updatedAt),
    );
  }

  public async applyMatchingUpdate(
    update: MatchingMarketDataUpdate,
  ): Promise<void> {
    const previous = await this.quoteStore.getQuote(
      this.tradingDate,
      update.securityId,
    );
    if (!previous) {
      throw new MarketDataUnavailableError();
    }

    const next = applyMatchingUpdate(previous, update);
    await this.quoteStore.saveAndPublish(next);
  }

  private async assertSecurityIdsExist(securityIds: string[]): Promise<void> {
    try {
      await Promise.all(
        securityIds.map((securityId) =>
          this.securityService.getSecurity(securityId),
        ),
      );
    } catch (error) {
      if (error instanceof SecurityNotFoundError) {
        throw new InvalidSecurityIdsError();
      }

      throw error;
    }
  }
}

export function createSimulatorQuote(
  tradingDate: string,
  securityId: string,
  updatedAt: string,
): QuoteSnapshot {
  return {
    securityId,
    tradingDate,
    currency: "VND",
    priceUnit: "VND_PER_UNIT",
    referencePrice: SIMULATOR_REFERENCE_PRICE,
    ceilingPrice: SIMULATOR_CEILING_PRICE,
    floorPrice: SIMULATOR_FLOOR_PRICE,
    lastPrice: null,
    lastQuantity: null,
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

function applyMatchingUpdate(
  previous: QuoteSnapshot,
  update: MatchingMarketDataUpdate,
): QuoteSnapshot {
  let next: QuoteSnapshot = {
    ...previous,
    bestBid: update.orderBook.bids[0]
      ? {
          price: update.orderBook.bids[0].price,
          quantity: update.orderBook.bids[0].quantity,
        }
      : null,
    bestAsk: update.orderBook.asks[0]
      ? {
          price: update.orderBook.asks[0].price,
          quantity: update.orderBook.asks[0].quantity,
        }
      : null,
    updatedAt: update.updatedAt,
  };

  for (const execution of update.executions) {
    next = {
      ...next,
      lastPrice: execution.price,
      lastQuantity: execution.quantity,
      totalVolume: next.totalVolume + execution.quantity,
      totalValue: next.totalValue + execution.price * execution.quantity,
      openPrice: next.openPrice ?? execution.price,
      highPrice:
        next.highPrice === null
          ? execution.price
          : Math.max(next.highPrice, execution.price),
      lowPrice:
        next.lowPrice === null
          ? execution.price
          : Math.min(next.lowPrice, execution.price),
    };
  }

  return next;
}

function splitQuotesByAvailability(
  securityIds: string[],
  quotes: Array<QuoteSnapshot | null>,
): QuoteQueryResult {
  const data: QuoteSnapshot[] = [];
  const missingQuoteSecurityIds: string[] = [];

  for (const [index, quote] of quotes.entries()) {
    if (quote) {
      data.push(quote);
    } else {
      missingQuoteSecurityIds.push(securityIds[index]);
    }
  }

  return { data, missingQuoteSecurityIds };
}

export class InvalidSecurityIdsError extends ApplicationError {
  public constructor() {
    super(
      400,
      "INVALID_SECURITY_IDS",
      "Danh sách mã định danh chứng khoán không hợp lệ.",
    );
  }
}

export class InvalidQuoteQueryError extends ApplicationError {
  public constructor(message: string) {
    super(400, "INVALID_QUOTE_QUERY", message);
  }
}

export class MarketDataUnavailableError extends ApplicationError {
  public constructor() {
    super(503, "MARKET_DATA_UNAVAILABLE", "Market Data hiện không khả dụng.");
  }
}
