import { Router } from "express";
import type { PortfolioService } from "./portfolio.service.js";

export function createPortfolioRouter(service: PortfolioService): Router {
  const router = Router();
  router.get("/api/accounts/:id/portfolio", async (request, response) => {
    response.json({
      data: await service.getPortfolio(request.params.id.trim()),
    });
  });
  return router;
}
