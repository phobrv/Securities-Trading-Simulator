import cors from "cors";
import express, { type Express } from "express";
import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createSecurityRouter } from "./modules/security-master/security.routes.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { createMarketDataRouter } from "./modules/market-data/market-data.routes.js";
import { MarketDataService } from "./modules/market-data/market-data.service.js";
import { createMarketSessionRouter } from "./modules/market-session/market-session.routes.js";
import { MarketSessionService } from "./modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "./modules/market-session/order-session-validator.js";
import { createMatchingSimulatorRouter } from "./modules/matching-simulator/matching.routes.js";
import { MatchingService } from "./modules/matching-simulator/matching.service.js";
import { SystemService } from "./modules/system/system.service.js";
import { createSystemRouter } from "./modules/system/system.routes.js";
import { createAccountRouter } from "./modules/accounts/account.routes.js";
import { AccountService } from "./modules/accounts/account.service.js";
import { createOmsRouter } from "./modules/oms/oms.routes.js";
import type { OmsService } from "./modules/oms/oms.service.js";
import { createOrderApiRouter } from "./modules/oms/order-api.routes.js";
import type { OrderApiService } from "./modules/oms/order-api.service.js";

export type AppDependencies = {
  systemService: SystemService;
  securityService: SecurityService;
  marketDataService: MarketDataService;
  marketSessionService: MarketSessionService;
  orderSessionValidator: OrderSessionValidator;
  matchingService?: MatchingService;
  accountService?: AccountService;
  omsService?: OmsService;
  orderApiService?: OrderApiService;
};

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function createApp({
  systemService,
  securityService,
  marketDataService,
  marketSessionService,
  orderSessionValidator,
  matchingService,
  accountService,
  omsService,
  orderApiService,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      exposedHeaders: ["Location", "Idempotency-Replayed", "X-Request-Id"],
      origin(origin, callback) {
        const isAllowedOrigin =
          origin === undefined ||
          env.corsOrigins.includes(origin) ||
          (env.nodeEnv !== "production" && isLocalDevelopmentOrigin(origin));

        callback(null, isAllowedOrigin);
      },
    }),
  );
  app.use("/api/orders", (_request, response, next) => {
    response.locals.requestId = randomUUID();
    response.set("X-Request-Id", response.locals.requestId);
    next();
  });
  app.use(express.json());
  app.use(createSystemRouter(systemService));
  app.use(createSecurityRouter(securityService));
  app.use(createMarketDataRouter(marketDataService));
  app.use(
    createMarketSessionRouter(marketSessionService, orderSessionValidator),
  );
  if (matchingService) {
    app.use(createMatchingSimulatorRouter(matchingService));
  }
  if (accountService) {
    app.use(createAccountRouter(accountService));
  }
  if (omsService && env.omsDemoEnabled) {
    app.use(createOmsRouter(omsService));
  }
  if (orderApiService) app.use(createOrderApiRouter(orderApiService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
