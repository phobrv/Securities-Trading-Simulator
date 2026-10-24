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
