import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { createOrderApiRouter } from "../../src/modules/oms/order-api.routes.js";
import { OrderApiService } from "../../src/modules/oms/order-api.service.js";
import { OrderApiRepository } from "../../src/modules/oms/order-api.repository.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import type { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import type { Database } from "../../src/infrastructure/database.js";
import { orderApiApp } from "../test-support/order-api.js";

const input = { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: 25000, quantity: 100 };
const clock = new FixedClock(new Date("2026-10-20T03:00:00Z"));

describe("order HTTP contract", () => {
  it.each(["ER_LOCK_WAIT_TIMEOUT", "ER_LOCK_DEADLOCK", "ECONNREFUSED", "ECONNRESET", "PROTOCOL_CONNECTION_LOST"])(
    "maps %s to a safe 503 with a request id", async (code) => {
      const service = { create: async () => { throw { code, message: "private SQL and connection details" }; } } as unknown as OrderApiService;
      const response = await request(orderApiApp(service)).post("/api/orders").set("Idempotency-Key", "k").send(input);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" }, requestId: response.headers["x-request-id"] });
      expect(JSON.stringify(response.body)).not.toContain("private SQL");
    });
  it("validates request and preserves per-request ids", async () => {
    const app = express().use((_, res, next) => { res.locals.requestId = "req-test"; next(); })
      .use(express.json()).use(createOrderApiRouter({} as OrderApiService)).use(errorHandler);
    expect((await request(app).post("/api/orders").send(input)).body).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" }, requestId: "req-test" });
    expect((await request(app).post("/api/orders").set("Idempotency-Key", "k").send({ ...input, price: 1.5 })).body.error.code).toBe("INVALID_REQUEST");
    expect((await request(app).post("/api/orders/abc/cancel").set("Idempotency-Key", "k").send({ extra: true })).status).toBe(400);
    expect((await request(app).post("/api/orders").set("Idempotency-Key", "k").set("Content-Type", "application/json").send("{")).body.error.code).toBe("INVALID_REQUEST");
  });

  it("sends saved status, replay header and location", async () => {
    const result = { status: 202, replayed: true, body: { data: { orderId: "ord-1", status: "PENDING_NEW" } } };
    const create = jest.fn<() => Promise<typeof result>>().mockResolvedValue(result);
    const app = express().use(express.json()).use(createOrderApiRouter({ create } as unknown as OrderApiService)).use(errorHandler);
    const response = await request(app).post("/api/orders").set("Idempotency-Key", "k").send(input);
    expect(response.status).toBe(202);
    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(response.headers.location).toBe("/api/orders/ord-1");
    expect(response.body).toEqual(result.body);
  });
});

describe("idempotency transaction", () => {
  it("rolls back duplicate insert before replay and detects a different hash", async () => {
    const execute = jest.fn<() => Promise<never>>().mockRejectedValue({ code: "ER_DUP_ENTRY", message: "uq_idempotency_scope_key" });
    let rolledBack = false;
    const database = {
      async transaction(work: (connection: unknown) => Promise<unknown>) {
        try { return await work({ query: async () => [[{ timeout: 50 }]], execute }); } catch (error) { rolledBack = true; throw error; }
      },
      async query() { expect(rolledBack).toBe(true); return [{ requestHash: Buffer.alloc(32, 1), status: 202, body: { data: { orderId: "old" } } }]; },
    } as unknown as Database;
    const repository = new OrderApiRepository(database, clock);
    const key = { scope: Buffer.alloc(32), key: Buffer.from("k"), hash: Buffer.alloc(32, 1) };
    const work = jest.fn<() => Promise<never>>();
    expect(await repository.execute(key, work)).toMatchObject({ replayed: true, body: { data: { orderId: "old" } } });
    expect(work).not.toHaveBeenCalled();
    await expect(repository.execute({ ...key, hash: Buffer.alloc(32, 2) }, work)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("canonicalizes object field order and scopes cancellation by order and account", async () => {
    const execute = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({});
    const find = jest.fn<() => Promise<any>>().mockResolvedValue({ id: "o", accountId: "acc-001" });
    const service = new OrderApiService({ execute, find } as unknown as OrderApiRepository, {} as MarketSessionService, clock, "demo");
    const first = { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: "25000", quantity: 100 } as const;
    await service.create(first, "key");
    await service.create({ quantity: 100, price: "25000", orderType: "LO", side: "BUY", securityId: "sec-001", accountId: "acc-001" }, "key");
    expect(execute.mock.calls[0][0]).toEqual(execute.mock.calls[1][0]);
    await service.cancel("o", "key");
    expect(execute.mock.calls[2][0].scope).not.toEqual(execute.mock.calls[0][0].scope);
  });
});
