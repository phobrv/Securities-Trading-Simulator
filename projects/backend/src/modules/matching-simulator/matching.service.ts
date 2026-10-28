import { ApplicationError } from "../../errors/application-error.js";
import type { Clock } from "../../shared/clock/clock.js";
import type { MarketSessionService } from "../market-session/market-session.service.js";
import type { SecurityService } from "../security-master/security.service.js";
import { MatchingEngine } from "./matching-engine.js";
import type { MatchingMarketDataUpdater } from "./matching-market-data.port.js";
import type {
  Execution,
  OrderBookSnapshot,
  SimulatorOrderSide,
  SubmitOrderResult,
} from "./matching.types.js";

export const simulatorSecurityId = "sec-001";

export type SubmitSimulatorOrderRequest = {
  clientOrderId: string;
  securityId: string;
  side: SimulatorOrderSide;
  orderType: "LO";
  price: number;
  quantity: number;
};

export class MatchingService {
  public constructor(
    private readonly matchingEngine: MatchingEngine,
    private readonly securityService: SecurityService,
    private readonly marketSessionService: MarketSessionService,
    private readonly clock: Clock,
    private readonly marketDataUpdater?: MatchingMarketDataUpdater,
  ) {}

  private submissionQueue: Promise<void> = Promise.resolve();

  public async submitOrder(
    request: SubmitSimulatorOrderRequest,
  ): Promise<SubmitOrderResult> {
    return this.runExclusively(() => this.submitOrderAndUpdateMarketData(request));
  }

  private async submitOrderAndUpdateMarketData(
    request: SubmitSimulatorOrderRequest,
  ): Promise<SubmitOrderResult> {
    const acceptedAt = this.clock.now();
    const security = await this.assertSupportedSecurity(request.securityId);
    const session = this.marketSessionService.getSessionAt(
      security.marketCode,
      acceptedAt,
    );

    if (session.state !== "CONTINUOUS") {
      throw new MatchingSessionNotSupportedError();
    }
    if (this.matchingEngine.hasClientOrderId(request.clientOrderId)) {
      throw new DuplicateClientOrderIdError();
    }

    const result = this.matchingEngine.submitOrder({
      ...request,
      acceptedAt: acceptedAt.toISOString(),
    });
    if (this.marketDataUpdater) {
      await this.marketDataUpdater.applyMatchingUpdate({
        securityId: request.securityId,
        executions: result.executions,
        orderBook: this.matchingEngine.getOrderBook(request.securityId),
        updatedAt: acceptedAt.toISOString(),
      });
    }

    return result;
  }

  private async runExclusively<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.submissionQueue;
    let release: () => void = () => undefined;
    this.submissionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  public async getOrderBook(securityId: string): Promise<OrderBookSnapshot> {
    await this.assertSupportedSecurity(securityId);
    return this.matchingEngine.getOrderBook(securityId);
  }

  public async getExecutions(securityId: string): Promise<Execution[]> {
    await this.assertSupportedSecurity(securityId);
    return this.matchingEngine.getExecutions(securityId);
  }

  private async assertSupportedSecurity(securityId: string) {
    const security = await this.securityService.getSecurity(securityId);

    if (security.tradingStatus !== "TRADABLE") {
      throw new SimulatorSecurityNotTradableError();
    }
    if (security.id !== simulatorSecurityId) {
      throw new SimulatorSecurityNotSupportedError();
    }

    return security;
  }
}

export class UnsupportedOrderTypeError extends ApplicationError {
  public constructor() {
    super(400, "UNSUPPORTED_ORDER_TYPE", "Simulator chỉ hỗ trợ lệnh LO.");
  }
}

export class DuplicateClientOrderIdError extends ApplicationError {
  public constructor() {
    super(409, "DUPLICATE_CLIENT_ORDER_ID", "clientOrderId đã được sử dụng.");
  }
}

export class SimulatorSecurityNotTradableError extends ApplicationError {
  public constructor() {
    super(
      422,
      "SECURITY_NOT_TRADABLE",
      "Chứng khoán không ở trạng thái được phép giao dịch.",
    );
  }
}

export class SimulatorSecurityNotSupportedError extends ApplicationError {
  public constructor() {
    super(
      422,
      "SECURITY_NOT_SUPPORTED",
      "Chứng khoán không thuộc phạm vi Matching Simulator.",
    );
  }
}

export class MatchingSessionNotSupportedError extends ApplicationError {
  public constructor() {
    super(
      422,
      "MATCHING_SESSION_NOT_SUPPORTED",
      "Matching Simulator chỉ hoạt động trong phiên CONTINUOUS.",
    );
  }
}
