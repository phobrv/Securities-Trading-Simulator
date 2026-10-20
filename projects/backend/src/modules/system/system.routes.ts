import { Router } from "express";

import type { SystemService } from "./system.service.js";

export function createSystemRouter(systemService: SystemService): Router {
  const router = Router();

  router.get("/health/live", (_request, response) => {
    response.status(200).json({ status: "LIVE" });
  });

  router.get("/health/ready", async (_request, response) => {
    const isReady = await systemService.isReady();

    if (!isReady) {
      response.status(503).json({
        status: "NOT_READY",
        checks: { database: "DOWN" },
      });
      return;
    }

    response.status(200).json({
      status: "READY",
      checks: { database: "UP" },
    });
  });

  router.get("/api/system/overview", (_request, response) => {
    response.status(200).json(systemService.getOverview());
  });

  return router;
}
