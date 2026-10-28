import { ApplicationError } from "../../errors/application-error.js";
import type { SecurityService } from "../security-master/security.service.js";
import {
  AvailabilityCalculationError,
  calculateAvailableCash,
  calculateAvailableQuantity,
} from "./availability.calculator.js";
import type {
  Account,
  AccountRepository,
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
  CashBalance,
  Position,
} from "./account.types.js";

export class AccountService {
  public constructor(
    private readonly accountRepository: AccountRepository,
    private readonly securityService: SecurityService,
  ) {}

  public async getBalance(accountId: string) {
    await this.requireAccount(accountId);
    const balance = await this.requireCashBalance(accountId);

    return {
      accountId: balance.accountId,
      currency: balance.currency,
      settledCash: balance.settledCash,
      reservedCash: balance.reservedCash,
      buyPayable: balance.buyPayable,
      blockedCash: balance.blockedCash,
      pendingReceivable: balance.pendingReceivable,
      availableCash: this.calculateCash(balance),
      policy: "CASH_ONLY_NO_ADVANCE" as const,
    };
  }

  public async getPositions(accountId: string) {
    await this.requireAccount(accountId);
    const positions = await this.accountRepository.findPositions(accountId);

    return positions.map((position) => ({
      securityId: position.securityId,
      symbol: position.symbol,
      marketCode: position.marketCode,
      settledQuantity: position.settledQuantity,
      pendingBuyQuantity: position.pendingBuyQuantity,
      pendingSellQuantity: position.pendingSellQuantity,
      reservedQuantity: position.reservedQuantity,
      blockedQuantity: position.blockedQuantity,
      availableQuantity: this.calculateQuantity(position),
    }));
  }

  public async checkAvailability(
    request: AvailabilityCheckRequest,
  ): Promise<AvailabilityCheckResult> {
    const account = await this.requireAccount(request.accountId);
    const security = await this.securityService.getSecurity(request.securityId);
    const cashBalance = await this.requireCashBalance(request.accountId);
    const availableCash = this.calculateCash(cashBalance);

    if (account.status !== "ACTIVE") {
      return {
        valid: false,
        scope: "ASSET_AVAILABILITY",
        reasonCode: "ACCOUNT_NOT_ACTIVE",
      };
    }
    if (security.tradingStatus !== "TRADABLE") {
      return {
        valid: false,
        scope: "ASSET_AVAILABILITY",
        reasonCode: "SECURITY_NOT_TRADABLE",
      };
    }
    if (request.side === "BUY") {
      return this.checkBuyAvailability(request, availableCash);
    }

    const positions = await this.accountRepository.findPositions(request.accountId);
    const position = positions.find(
      (item) => item.securityId === request.securityId,
    );
    const availableQuantity = position ? this.calculateQuantity(position) : 0;

    return this.checkSellAvailability(request.quantity, availableQuantity);
  }

  private async requireAccount(accountId: string): Promise<Account> {
    const account = await this.accountRepository.findAccount(accountId);

    if (!account) {
      throw new AccountNotFoundError();
    }

    return account;
  }

  private async requireCashBalance(accountId: string): Promise<CashBalance> {
    const balance = await this.accountRepository.findCashBalance(accountId);

    if (!balance) {
      throw new AccountDataIntegrityError(
        "Tài khoản không có bản ghi số dư tiền.",
      );
    }

    return balance;
  }

  private calculateCash(balance: CashBalance): bigint {
    try {
      return calculateAvailableCash(balance);
    } catch (error) {
      if (error instanceof AvailabilityCalculationError) {
        throw new AccountDataIntegrityError(error.message);
      }
      throw error;
    }
  }

  private calculateQuantity(position: Position): number {
    try {
      return calculateAvailableQuantity(position);
    } catch (error) {
      if (error instanceof AvailabilityCalculationError) {
        throw new AccountDataIntegrityError(error.message);
      }
      throw error;
    }
  }

  private checkBuyAvailability(
    request: AvailabilityCheckRequest,
    availableCash: bigint,
  ): AvailabilityCheckResult {
    const requiredCash = BigInt(request.price) * BigInt(request.quantity);

    if (requiredCash <= availableCash) {
      return {
        valid: true,
        scope: "ASSET_AVAILABILITY",
        requiredCash,
        availableCash,
      };
    }

    return {
      valid: false,
      scope: "ASSET_AVAILABILITY",
      reasonCode: "INSUFFICIENT_CASH",
      requiredCash,
      availableCash,
      shortfallCash: requiredCash - availableCash,
    };
  }

  private checkSellAvailability(
    requiredQuantity: number,
    availableQuantity: number,
  ): AvailabilityCheckResult {
    if (requiredQuantity <= availableQuantity) {
      return {
        valid: true,
        scope: "ASSET_AVAILABILITY",
        requiredQuantity,
        availableQuantity,
      };
    }

    return {
      valid: false,
      scope: "ASSET_AVAILABILITY",
      reasonCode: "INSUFFICIENT_SECURITIES",
      requiredQuantity,
      availableQuantity,
      shortfallQuantity: requiredQuantity - availableQuantity,
    };
  }
}

export class AccountNotFoundError extends ApplicationError {
  public constructor() {
    super(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");
  }
}

export class AccountDataIntegrityError extends ApplicationError {
  public constructor(message: string) {
    super(500, "ACCOUNT_DATA_INTEGRITY_ERROR", message);
  }
}
