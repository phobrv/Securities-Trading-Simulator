import cors from "cors";
import express, { type Express } from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createSecurityRouter } from "./modules/security-master/security.routes.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { createMarketDataRouter } from "./modules/market-data/market-data.routes.js";
import { MarketDataService } from "./modules/market-data/market-data.service.js";
import { createMarketSessionRouter } from "./modules/market-session/market-session.routes.js";
import { MarketSessionService } from "./modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "./modules/market-session/order-session-validator.js";
import { SystemService } from "./modules/system/system.service.js";
import { createSystemRouter } from "./modules/system/system.routes.js";

export type AppDependencies = {
  systemService: SystemService;
  securityService: SecurityService;
  marketDataService: MarketDataService;
  marketSessionService: MarketSessionService;
  orderSessionValidator: OrderSessionValidator;
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
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        const isAllowedOrigin =
          origin === undefined ||
          env.corsOrigins.includes(origin) ||
          (env.nodeEnv !== "production" && isLocalDevelopmentOrigin(origin));

        callback(null, isAllowedOrigin);
      },
    }),
  );
  app.use(express.json());
  app.use(createSystemRouter(systemService));
  app.use(createSecurityRouter(securityService));
  app.use(createMarketDataRouter(marketDataService));
  app.use(
    createMarketSessionRouter(marketSessionService, orderSessionValidator),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
