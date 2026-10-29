import { Router } from "express";
import type { CashReadService } from "./cash-read.service.js";

export function createCashReadRouter(service: CashReadService): Router {
  const router = Router();
  router.get("/api/orders/:id/cash-reservation", async (request, response) => {
    response.json({ data: await service.getReservation(request.params.id) });
  });
  router.get("/api/accounts/:id/cash-ledger", async (request, response) => {
    response.json({ data: await service.getLedger(request.params.id) });
  });
  return router;
}
