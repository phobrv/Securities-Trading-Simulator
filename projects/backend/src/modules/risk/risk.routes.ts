import { Router } from "express";
import { ApplicationError } from "../../errors/application-error.js";
import type { MarginOrder } from "./margin.types.js";
import type { RiskCheckService } from "./risk-check.service.js";

export function createRiskRouter(service: RiskCheckService): Router {
  const router = Router();
  router.post("/api/risk/margin-simulations", async (request, response) => {
    const body = request.body as
      { scenarioId?: unknown; order?: Partial<MarginOrder> } | undefined;
    const order = body?.order;
    if (
      typeof body?.scenarioId !== "string" ||
      !body.scenarioId.trim() ||
      body.scenarioId.length > 36 ||
      !order ||
      typeof order !== "object" ||
      typeof order.securityId !== "string" ||
      !order.securityId.trim() ||
      order.securityId.length > 36 ||
      order.side !== "BUY" ||
      !Number.isSafeInteger(order.price) ||
      order.price! <= 0 ||
      !Number.isSafeInteger(order.quantity) ||
      order.quantity! <= 0
    ) {
      throw new ApplicationError(
        400,
        "INVALID_REQUEST",
        "Scenario và lệnh BUY phải hợp lệ; giá và số lượng là số nguyên dương an toàn.",
      );
    }
    response.json({
      data: await service.simulate(body.scenarioId.trim(), {
        securityId: order.securityId.trim(),
        side: "BUY",
        price: order.price!,
        quantity: order.quantity!,
      }),
    });
  });
  return router;
}
