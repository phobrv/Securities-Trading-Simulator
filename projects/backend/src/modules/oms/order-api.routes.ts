import { Router } from "express";
import { ApplicationError } from "../../errors/application-error.js";
import { parseOrder } from "./oms.validation.js";
import type { OrderApiService } from "./order-api.service.js";

function idempotencyKey(value: string | undefined): string {
  if (!value) throw new ApplicationError(400, "IDEMPOTENCY_KEY_REQUIRED", "Cần cung cấp Idempotency-Key.");
  if (Buffer.byteLength(value, "utf8") > 128 || !value.trim()) throw new ApplicationError(400, "INVALID_REQUEST", "Idempotency-Key không hợp lệ.");
  return value;
}

export function createOrderApiRouter(service: OrderApiService): Router {
  const router = Router();
  router.post("/api/orders", async (request, response) => {
    const key = idempotencyKey(request.get("Idempotency-Key"));
    if (typeof request.body?.price !== "number" || !Number.isSafeInteger(request.body.price) || request.body.price <= 0) {
      throw new ApplicationError(400, "INVALID_REQUEST", "Giá phải là số nguyên dương an toàn.");
    }
    let input;
    try { input = parseOrder(request.body); } catch { throw new ApplicationError(400, "INVALID_REQUEST", "Nội dung yêu cầu không hợp lệ."); }
    const result = await service.create(input, key);
    response.set("Location", `/api/orders/${result.body.data.orderId}`);
    response.set("Idempotency-Replayed", String(result.replayed)).status(result.status).json(result.body);
  });
  router.post("/api/orders/:id/cancel", async (request, response) => {
    const key = idempotencyKey(request.get("Idempotency-Key"));
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body) || Object.keys(request.body).length) {
      throw new ApplicationError(400, "INVALID_REQUEST", "Nội dung hủy phải là object rỗng.");
    }
    const result = await service.cancel(request.params.id, key);
    response.set("Idempotency-Replayed", String(result.replayed)).status(result.status).json(result.body);
  });
  router.get("/api/orders/:id", async (request, response) => {
    const { id, ...order } = await service.get(request.params.id);
    response.json({ data: { orderId: id, ...order } });
  });
  return router;
}
