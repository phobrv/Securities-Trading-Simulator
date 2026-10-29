import { calculateAvailableQuantity } from "../accounts/availability.calculator.js";
import { AccountNotFoundError } from "../accounts/account.service.js";
import type { AccountRepository, Position } from "../accounts/account.types.js";
import { MarketDataUnavailableError } from "../market-data/market-data.service.js";
import type {
  QuoteQueryResult,
  QuoteSnapshot,
} from "../market-data/market-data.types.js";
import { averageCost } from "./cost-basis.calculator.js";

export class PortfolioService {
  public constructor(
    private readonly accounts: AccountRepository,
    private readonly marketData: {
      getQuotes(ids: string[]): Promise<QuoteQueryResult>;
    },
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getPortfolio(accountId: string) {
    if (!(await this.accounts.findAccount(accountId)))
      throw new AccountNotFoundError();
    const positions = await this.accounts.findPositions(accountId);
    let quotes: QuoteSnapshot[] = [];
    if (positions.length) {
      try {
        quotes = (
          await this.marketData.getQuotes(positions.map((p) => p.securityId))
        ).data;
      } catch (error) {
        if (!(error instanceof MarketDataUnavailableError)) throw error;
      }
    }
    return {
      accountId,
      currency: "VND",
      valuationPolicy: "LAST_TRADED_PRICE",
      positions: positions.map((position) =>
        this.valuePosition(
          position,
          quotes.find((q) => q.securityId === position.securityId),
        ),
      ),
    };
  }

  private valuePosition(position: Position, quote?: QuoteSnapshot) {
    const economic =
      position.settledQuantity +
      position.pendingBuyQuantity -
      position.pendingSellQuantity;
    if (!Number.isSafeInteger(economic) || economic < 0)
      throw new Error("Invalid economic quantity");
    const cost = position.totalCost ?? null;
    if (economic === 0 && cost !== null && cost !== 0n)
      throw new Error("Nonzero cost for empty position");
    const price = quote?.lastPrice ?? null;
    if (price !== null && (!Number.isSafeInteger(price) || price <= 0))
      throw new Error("Invalid market price");
    const value = price === null ? null : BigInt(price) * BigInt(economic);
    const stale =
      quote && this.now().getTime() - Date.parse(quote.updatedAt) > 300_000;
    return {
      securityId: position.securityId,
      symbol: position.symbol,
      marketCode: position.marketCode,
      settledQuantity: position.settledQuantity,
      pendingBuyQuantity: position.pendingBuyQuantity,
      pendingSellQuantity: position.pendingSellQuantity,
      economicQuantity: economic,
      availableQuantity: calculateAvailableQuantity(position),
      costStatus: cost === null ? "MISSING" : "KNOWN",
      totalCost: cost?.toString() ?? null,
      averageCost: cost === null ? null : averageCost(cost, economic),
      marketPrice: price?.toString() ?? null,
      marketValue: value?.toString() ?? null,
      unrealizedPnl:
        value === null || cost === null ? null : (value - cost).toString(),
      realizedPnl: position.realizedPnl?.toString() ?? null,
      quoteUpdatedAt: quote?.updatedAt ?? null,
      valuationStatus:
        price === null ? "UNAVAILABLE" : stale ? "STALE" : "AVAILABLE",
    };
  }
}
