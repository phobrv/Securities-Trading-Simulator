import { Router } from "express";
import { OmsService } from "./oms.service.js";
import { parseEvent, parseOrder } from "./oms.validation.js";

export function createOmsRouter(service: OmsService): Router {
  const router = Router();
  router.post("/api/oms-demo/orders", async (request, response) => {
    response.status(201).json({ data: await service.create(parseOrder(request.body)) });
  });
  router.get("/api/oms-demo/orders/:id", async (request, response) => {
    response.json({ data: await service.get(request.params.id) });
  });
  router.get("/api/oms-demo/orders/:id/events", async (request, response) => {
    const events = await service.events(request.params.id);
    response.json({ data: events.map(({ event, ...record }) => ({ ...record, eventType: event.type,
      reasonCode: "reasonCode" in event ? event.reasonCode : null, payload: event.payload })) });
  });
  router.post("/api/oms-demo/orders/:id/simulate", async (request, response) => {
    response.json({ data: await service.apply(request.params.id, parseEvent(request.body)) });
  });
  return router;
}
