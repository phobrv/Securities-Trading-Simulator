import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createApp, type AppDependencies } from "../../src/app.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { applyOrderEvent } from "../../src/modules/oms/oms.reducer.js";
import { createOmsRouter } from "../../src/modules/oms/oms.routes.js";
import { OmsService } from "../../src/modules/oms/oms.service.js";
import type { OmsRepository, Order, OrderEvent, RecordedEvent } from "../../src/modules/oms/oms.types.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";

const input = { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: "25000", quantity: 100 } as const;
const received: OrderEvent = { type: "OrderReceived", payload: input };
const accepted: OrderEvent = { type: "OrderAccepted", payload: {} };
const requestCancel: OrderEvent = { type: "CancelRequested", payload: {} };
const confirmed: OrderEvent = { type: "CancelConfirmed", payload: {} };
const rejected: OrderEvent = { type: "CancelRejected", reasonCode: "FILLED", payload: { message: "Khớp hết" } };
const fill = (quantity: number, price = "24900"): OrderEvent => ({ type: "ExecutionReceived", payload: { executionId: "exec", quantity, price } });
const reduce = (events: OrderEvent[]): Order => events.reduce<Order | null>((order, event) => applyOrderEvent(order, event, "id"), null)!;

class FakeRepository implements OmsRepository {
  private order: Order | null = null;
  public history: RecordedEvent[] = [];
  public async create(order: Order, event: RecordedEvent): Promise<void> { this.order = order; this.history.push(event); }
  public async find(id: string): Promise<Order | null> { return this.order?.id === id ? this.order : null; }
  public async events(id: string): Promise<RecordedEvent[] | null> { return (await this.find(id)) ? this.history : null; }
  public async apply(id: string, update: (order: Order) => { order: Order; event: RecordedEvent }): Promise<Order | null> {
    const previous = await this.find(id);
    if (!previous) return null;
    const result = update(previous);
    this.order = result.order;
    this.history.push(result.event);
    return result.order;
  }
}

describe("OMS reducer", () => {
  it("replay hủy sau khớp trong khi chờ", () => {
    const order = reduce([received, accepted, fill(40), requestCancel, fill(20, "25000"), confirmed]);
    expect(order).toMatchObject({ status: "CANCELED", cancelRequestStatus: "ACCEPTED", filledQuantity: 60,
      remainingQuantity: 0, canceledQuantity: 40, version: 6 });
  });
  it("cho phép từ chối hủy khi khớp hết và chặn xác nhận hủy", () => {
    const events = [received, accepted, fill(40), requestCancel, fill(60)];
    expect(() => reduce([...events, confirmed])).toThrow();
    expect(reduce([...events, rejected])).toMatchObject({ status: "FILLED", cancelRequestStatus: "REJECTED", filledQuantity: 100, canceledQuantity: 0 });
  });
  it("chặn event sai, vượt lượng và vi phạm giá hai phía", () => {
    expect(() => reduce([received, fill(1)])).toThrow();
    expect(() => reduce([received, accepted, fill(101)])).toThrow();
    expect(() => reduce([received, accepted, fill(1, "25001")])).toThrow();
    const sell: OrderEvent = { type: "OrderReceived", payload: { ...input, side: "SELL" } };
    expect(() => reduce([sell, accepted, fill(1, "24999")])).toThrow();
    expect(() => reduce([received, accepted, requestCancel, requestCancel])).toThrow();
    expect(() => reduce([received, accepted, confirmed])).toThrow();
    expect(() => reduce([received, accepted, fill(100), confirmed])).toThrow();
  });
  it("từ chối lệnh và cho phép yêu cầu hủy lại sau từ chối", () => {
    expect(reduce([received, { type: "OrderRejected", reasonCode: "X", payload: { message: "x" } }]))
      .toMatchObject({ status: "REJECTED", quantity: 100, remainingQuantity: 0, filledQuantity: 0, canceledQuantity: 0 });
    expect(reduce([received, accepted, requestCancel, rejected, requestCancel]).cancelRequestStatus).toBe("PENDING");
  });
});

describe("OMS API", () => {
  it("không đăng ký endpoint khi demo bị tắt", async () => {
    const repository = new FakeRepository();
    const app = createApp({
      systemService: {}, securityService: {}, marketDataService: {}, marketSessionService: {},
      orderSessionValidator: {}, omsService: new OmsService(repository, new FixedClock(new Date())),
    } as unknown as AppDependencies);
    expect((await request(app).get("/api/oms-demo/orders/id")).status).toBe(404);
  });
  it("cấp event, trả timeline theo sequence và validate input", async () => {
    const repository = new FakeRepository();
    const service = new OmsService(repository, new FixedClock(new Date("2026-10-20T03:00:00Z")));
    const app = express().use(express.json()).use(createOmsRouter(service)).use(errorHandler);
    const created = await request(app).post("/api/oms-demo/orders").send({ ...input, price: 25000 });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const url = `/api/oms-demo/orders/${id}`;
    for (const event of [{ type: "OrderAccepted" }, { type: "ExecutionReceived", executionId: "x", quantity: 40, price: 24900 },
      { type: "CancelRequested" }, { type: "ExecutionReceived", executionId: "y", quantity: 20, price: 25000 }, { type: "CancelConfirmed" }]) {
      expect((await request(app).post(`${url}/simulate`).send(event)).status).toBe(200);
    }
    const result = await request(app).get(url);
    expect(result.body.data).toMatchObject({ price: "25000", status: "CANCELED", filledQuantity: 60, canceledQuantity: 40, version: 6 });
    const timeline = await request(app).get(`${url}/events`);
    expect(timeline.body.data.map((event: RecordedEvent) => event.eventSequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(timeline.body.data.map((event: RecordedEvent) => event.occurredAt)).size).toBe(1);
    expect(reduce(repository.history.map((item) => item.event))).toMatchObject({ ...result.body.data, id: "id" });
    expect((await request(app).post(`${url}/simulate`).send({ type: "OrderAccepted", status: "NEW" })).status).toBe(400);
    expect((await request(app).post(`${url}/simulate`).send({ type: "CancelConfirmed" })).status).toBe(409);
    expect((await request(app).get("/api/oms-demo/orders/missing/events")).status).toBe(404);
    expect((await request(app).post("/api/oms-demo/orders").send({ ...input, price: 9007199254740992 })).status).toBe(400);
    expect((await request(app).post(url + "/simulate").set("Content-Type", "application/json").send("{" )).status).toBe(400);
    expect(repository.history).toHaveLength(6);
  });
});
