import { beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import type { RowDataPacket } from "mysql2/promise";
import { createDatabase } from "../../src/infrastructure/database.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderApiRepository } from "../../src/modules/oms/order-api.repository.js";
import { createOrderApiRouter } from "../../src/modules/oms/order-api.routes.js";
import { OrderApiService } from "../../src/modules/oms/order-api.service.js";
import { MySqlOmsRepository } from "../../src/modules/oms/oms.repository.js";
import { OmsService } from "../../src/modules/oms/oms.service.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";

// Run only against a migrated disposable database with the standard fixtures.
const mysqlDescribe = process.env.OMS_MYSQL_TEST === "true" ? describe : describe.skip;
mysqlDescribe("order API MySQL", () => {
  beforeAll(() => {
    if (!process.env.DB_NAME || !process.env.DB_NAME.toLowerCase().includes("test")) {
      throw new Error("Set DB_NAME explicitly to a disposable database whose name includes 'test'.");
    }
  });
  it("rolls back order, event and key when processing fails before saving the response", async () => {
    const database = createDatabase();
    const repository = new OrderApiRepository(database, new FixedClock(new Date("2026-10-20T03:00:00Z")));
    const scope = Buffer.from(randomUUID().replaceAll("-", "").repeat(2), "hex");
    const key = { scope, key: Buffer.from(randomUUID()), hash: Buffer.alloc(32, 1) };
    let orderId = "";
    try {
      await expect(repository.execute(key, async (connection) => {
        const order = await repository.create(connection, { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: "25000", quantity: 100 });
        orderId = order.id;
        throw new Error("response persistence failed");
      })).rejects.toThrow("response persistence failed");
      const rows = await database.query<(RowDataPacket & { count: number })[]>("SELECT COUNT(*) AS count FROM idempotency_requests WHERE scope_hash = ?", [scope]);
      expect(rows[0].count).toBe(0);
      expect(await repository.find(orderId)).toBeNull();
      const events = await database.query<(RowDataPacket & { count: number })[]>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?", [orderId]);
      expect(events[0].count).toBe(0);
    } finally {
      await database.close();
    }
  });

  it("serializes concurrent requests, replays original responses and handles cancellation", async () => {
    const database = createDatabase();
    const clock = new FixedClock(new Date("2026-10-20T03:00:00Z"));
    const sessions = new MarketSessionService(marketSessionConfigs, clock, "FIXED");
    const requester = `test-${randomUUID()}`;
    const service = () => new OrderApiService(new OrderApiRepository(database, clock), sessions, clock, requester);
    const app = () => express().use(express.json()).use(createOrderApiRouter(service())).use(errorHandler);
    const oms = new OmsService(new MySqlOmsRepository(database), clock);
    const key = randomUUID();
    const input = { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: 25000, quantity: 100 };
    let id: string | undefined;
    try {
      const [a, b] = await Promise.all([request(app()).post("/api/orders").set("Idempotency-Key", key).send(input),
        request(app()).post("/api/orders").set("Idempotency-Key", key).send(input)]);
      expect([a.status, b.status]).toEqual([202, 202]);
      expect([a.headers["idempotency-replayed"], b.headers["idempotency-replayed"]].sort()).toEqual(["false", "true"]);
      expect(a.body).toEqual(b.body);
      id = a.body.data.orderId;
      expect(await oms.events(id!)).toHaveLength(1);
      const conflict = await request(app()).post("/api/orders").set("Idempotency-Key", key).send({ ...input, quantity: 101 });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
      await oms.apply(id!, { type: "OrderAccepted", payload: {} });
      await oms.apply(id!, { type: "ExecutionReceived", payload: { executionId: randomUUID(), quantity: 40, price: "25000" } });
      const replay = await request(app()).post("/api/orders").set("Idempotency-Key", key)
        .send({ quantity: 100, price: 25000, orderType: "LO", side: "BUY", securityId: "sec-001", accountId: "acc-001" });
      expect(replay.body).toEqual(a.body);
      expect((await request(app()).get(`/api/orders/${id}`)).body.data.status).toBe("PARTIALLY_FILLED");
      const cancelKey = randomUUID();
      const cancel = await request(app()).post(`/api/orders/${id}/cancel`).set("Idempotency-Key", cancelKey).send({});
      expect(cancel.body.data).toMatchObject({ status: "PARTIALLY_FILLED", cancelRequestStatus: "PENDING", filledQuantity: 40, remainingQuantity: 60 });
      const cancelReplay = await request(app()).post(`/api/orders/${id}/cancel`).set("Idempotency-Key", cancelKey).send({});
      expect(cancelReplay.body).toEqual(cancel.body);
      expect(cancelReplay.headers["idempotency-replayed"]).toBe("true");
      expect((await request(app()).post(`/api/orders/${id}/cancel`).set("Idempotency-Key", randomUUID()).send({})).body.error.code).toBe("CANCEL_ALREADY_PENDING");
      expect(await oms.events(id!)).toHaveLength(4);
    } finally {
      if (id) await database.transaction(async (connection) => {
        const orderId = id!;
        await connection.execute("DELETE FROM idempotency_requests WHERE order_id = ?", [orderId]);
        await connection.execute("DELETE FROM order_events WHERE order_id = ?", [orderId]);
        await connection.execute("DELETE FROM orders WHERE id = ?", [orderId]);
      });
      await database.close();
    }
  });
});
