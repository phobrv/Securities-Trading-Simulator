import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "../../src/modules/market-session/order-session-validator.js";
import type { SecurityService } from "../../src/modules/security-master/security.service.js";

export function createMarketSessionDependencies(
  securityService: SecurityService,
) {
  const clock = new FixedClock(new Date("2026-10-20T02:10:00Z"));
  const marketSessionService = new MarketSessionService(
    marketSessionConfigs,
    clock,
    "FIXED",
  );

  return {
    marketSessionService,
    orderSessionValidator: new OrderSessionValidator(
      securityService,
      marketSessionService,
      clock,
    ),
  };
}
