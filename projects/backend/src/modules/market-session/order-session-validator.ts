import type { SecurityService } from "../security-master/security.service.js";

import type {
  SessionOrderValidationRequest,
  SessionOrderValidationResult,
} from "./market-session.types.js";
import type { MarketSessionService } from "./market-session.service.js";
import type { Clock } from "../../shared/clock/clock.js";

export class OrderSessionValidator {
  public constructor(
    private readonly securityService: SecurityService,
    private readonly marketSessionService: MarketSessionService,
    private readonly clock: Clock,
  ) {}

  public async validate(
    request: SessionOrderValidationRequest,
  ): Promise<SessionOrderValidationResult> {
    const evaluatedAt = this.clock.now();
    const security = await this.securityService.getSecurity(request.securityId);
    const session = this.marketSessionService.getSessionAt(
      security.marketCode,
      evaluatedAt,
    );
    const reasonCode = getReasonCode(
      security.tradingStatus,
      session,
      request.orderType,
    );

    return {
      valid: reasonCode === null,
      scope: "SECURITY_AND_SESSION",
      securityId: security.id,
      marketCode: security.marketCode,
      sessionState: session.state,
      evaluatedAt: session.evaluatedAt,
      reasonCode,
    };
  }
}

function getReasonCode(
  tradingStatus: string,
  session: ReturnType<MarketSessionService["getSessionAt"]>,
  orderType: SessionOrderValidationRequest["orderType"],
): SessionOrderValidationResult["reasonCode"] {
  if (tradingStatus !== "TRADABLE") {
    return "SECURITY_NOT_TRADABLE";
  }
  if (!session.isTradingDay) {
    return "NON_TRADING_DAY";
  }
  if (!session.acceptsNewOrders) {
    return "SESSION_NOT_ACCEPTING_ORDERS";
  }
  if (!session.allowedOrderTypes.includes(orderType)) {
    return "ORDER_TYPE_NOT_ALLOWED_IN_SESSION";
  }

  return null;
}
