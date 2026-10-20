import cors from "cors";
import express, { type Express } from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { SystemService } from "./modules/system/system.service.js";
import { createSystemRouter } from "./modules/system/system.routes.js";

export type AppDependencies = {
  systemService: SystemService;
};

export function createApp({ systemService }: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );
  app.use(express.json());
  app.use(createSystemRouter(systemService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
