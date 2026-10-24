import cors from "cors";
import express, { type Express } from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createSecurityRouter } from "./modules/security-master/security.routes.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { SystemService } from "./modules/system/system.service.js";
import { createSystemRouter } from "./modules/system/system.routes.js";

export type AppDependencies = {
  systemService: SystemService;
  securityService: SecurityService;
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
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
