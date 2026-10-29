import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createDatabase, type Database } from "../../src/infrastructure/database.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { CashReadRepository } from "../../src/modules/cash/cash-read.repository.js";
import { CashReadService } from "../../src/modules/cash/cash-read.service.js";
import { createCashReadRouter } from "../../src/modules/cash/cash-read.routes.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { MySqlOmsRepository } from "../../src/modules/oms/oms.repository.js";
import { OmsService } from "../../src/modules/oms/oms.service.js";
import { createOmsRouter } from "../../src/modules/oms/oms.routes.js";
import { OrderApiRepository } from "../../src/modules/oms/order-api.repository.js";
import { createOrderApiRouter } from "../../src/modules/oms/order-api.routes.js";
import { OrderApiService } from "../../src/modules/oms/order-api.service.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { AccountService } from "../../src/modules/accounts/account.service.js";
import { MySqlAccountRepository } from "../../src/modules/accounts/account.repository.js";
import { createAccountRouter } from "../../src/modules/accounts/account.routes.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import { MySqlSecurityRepository } from "../../src/modules/security-master/security.repository.js";

const mysqlDescribe = process.env.CASH_MYSQL_TEST === "true" ? describe : describe.skip;
const clock = new FixedClock(new Date("2026-10-20T03:00:00Z"));
const sessions = new MarketSessionService(marketSessionConfigs, clock, "FIXED");

async function fixture(database: Database) {
  const id = randomUUID();
  await database.transaction(async (c) => {
    await c.execute("INSERT INTO accounts (id, customer_ref, status) VALUES (?, ?, 'ACTIVE')", [id, id]);
    await c.execute("INSERT INTO cash_balances (account_id, settled_cash) VALUES (?, 10000000)", [id]);
    await c.execute(`INSERT INTO cash_ledger_entries (account_id, entry_type, business_key, delta_settled_cash, payload, occurred_at)
      VALUES (?, 'OPENING', ?, 10000000, '{}', UTC_TIMESTAMP(3))`, [id, `OPENING:${id}:v1`]);
  });
  return id;
}

function app(database: Database) {
  const api = new OrderApiService(new OrderApiRepository(database, clock), sessions, clock, "test");
  const oms = new OmsService(new MySqlOmsRepository(database), clock);
  const accounts = new AccountService(new MySqlAccountRepository(database), new SecurityService(new MySqlSecurityRepository(database)));
  return express().use(express.json()).use(createOrderApiRouter(api)).use(createOmsRouter(oms))
    .use(createCashReadRouter(new CashReadService(new CashReadRepository(database)))).use(createAccountRouter(accounts)).use(errorHandler);
}

function input(accountId: string, quantity = 100) {
  return { accountId, securityId: "sec-001", side: "BUY", orderType: "LO", price: 25000, quantity };
}

function failLedger(database: Database): Database {
  return { ...database, transaction: (work) => database.transaction((connection) => {
    const proxy = new Proxy(connection, { get(target, key) {
      if (key === "execute") return async (sql: string, values?: unknown[]) => {
        if (sql.includes("INSERT INTO cash_ledger_entries")) throw new Error("injected ledger failure");
        return (target.execute as (sql: string, values?: unknown[]) => Promise<unknown>).call(target, sql, values);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    } }) as PoolConnection;
    return work(proxy);
  }) };
}

mysqlDescribe("day 10 cash transactions", () => {
  beforeAll(() => {
    if (!process.env.DB_NAME?.toLowerCase().includes("test")) throw new Error("DB_NAME must name a disposable test database");
  });

  it("seeds acc-003 with an opening balance and matching ledger", async () => {
    const db = createDatabase();
    try {
      const [balance] = await db.query<RowDataPacket[]>("SELECT settled_cash, reserved_cash, buy_payable, blocked_cash, pending_receivable FROM cash_balances WHERE account_id = 'acc-003'");
      expect(balance).toMatchObject({ settled_cash: "10000000", reserved_cash: "0", buy_payable: "0", blocked_cash: "0", pending_receivable: "0" });
      const ledger = await new CashReadRepository(db).ledger("acc-003");
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ entryType: "OPENING", deltaSettledCash: "10000000" });
    } finally { await db.close(); }
  });

  it("replays, executes, cancels and reconciles the ledger", async () => {
    const db = createDatabase();
    try {
      const accountId = await fixture(db); const server = app(db); const key = randomUUID();
      const first = await request(server).post("/api/orders").set("Idempotency-Key", key).send(input(accountId));
      expect(first.status).toBe(202);
      const id = first.body.data.orderId;
      const again = await request(server).post("/api/orders").set("Idempotency-Key", key).send(input(accountId));
      expect(again.body).toEqual(first.body); expect(again.headers["idempotency-replayed"]).toBe("true");
      const sim = (event: object) => request(server).post(`/api/oms-demo/orders/${id}/simulate`).send(event);
      expect((await sim({ type: "OrderAccepted" })).status).toBe(200);
      const execution = { type: "ExecutionReceived", executionId: "e1", quantity: 40, price: 24900 };
      const executions = await Promise.all([sim(execution), sim(execution)]);
      expect(executions.map((result) => result.body.data.filledQuantity)).toEqual([40, 40]);
      expect((await sim({ ...execution, price: 24800 })).status).toBe(409);
      expect((await request(server).post(`/api/orders/${id}/cancel`).set("Idempotency-Key", randomUUID()).send({})).status).toBe(202);
      const before = await request(server).get(`/api/orders/${id}/cash-reservation`);
      expect(before.body.data.remainingAmount).toBe("1500000");
      const canceled = await sim({ type: "CancelConfirmed" });
      expect(canceled.body.data).toMatchObject({ status: "CANCELED", filledQuantity: 40, canceledQuantity: 60 });
      expect((await sim(execution)).body.data.filledQuantity).toBe(40);
      const reservation = await request(server).get(`/api/orders/${id}/cash-reservation`);
      expect(reservation.body.data).toMatchObject({ initialAmount: "2500000", remainingAmount: "0", consumedAmount: "996000", releasedAmount: "1504000", status: "CLOSED" });
      const ledger = (await request(server).get(`/api/accounts/${accountId}/cash-ledger`)).body.data;
      expect(ledger.map((entry: { entryType: string }) => entry.entryType)).toEqual(["OPENING", "RESERVE", "EXECUTION", "RELEASE"]);
      const [balance] = await db.query<RowDataPacket[]>("SELECT * FROM cash_balances WHERE account_id = ?", [accountId]);
      for (const [column, delta] of [["settled_cash", "deltaSettledCash"], ["reserved_cash", "deltaReservedCash"], ["buy_payable", "deltaBuyPayable"], ["blocked_cash", "deltaBlockedCash"], ["pending_receivable", "deltaPendingReceivable"]]) {
        expect(ledger.reduce((sum: bigint, entry: Record<string, string>) => sum + BigInt(entry[delta]), 0n).toString()).toBe(balance[column]);
      }
      expect(balance).toMatchObject({ settled_cash: "10000000", reserved_cash: "0", buy_payable: "996000" });
      expect((await request(server).get(`/api/accounts/${accountId}/balances`)).body.data.availableCash).toBe("9004000");
    } finally { await db.close(); }
  });

  it("serializes two independent 7 million orders", async () => {
    const db = createDatabase();
    try {
      const id = await fixture(db); const server = app(db);
      const responses = await Promise.all([1, 2].map(() => request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input(id, 280))));
      expect(responses.map((r) => r.status).sort()).toEqual([202, 422]);
      const [row] = await db.query<RowDataPacket[]>(`SELECT b.reserved_cash AS reserved, SUM(r.remaining_amount) AS total
        FROM cash_balances b JOIN cash_reservations r ON r.account_id = b.account_id WHERE b.account_id = ? GROUP BY b.account_id`, [id]);
      expect(row).toMatchObject({ reserved: "7000000", total: "7000000" });
    } finally { await db.close(); }
  });

  it("releases on order rejection, but not on a rejected cancellation", async () => {
    const db = createDatabase();
    try {
      const accountId = await fixture(db); const server = app(db);
      const create = async () => (await request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input(accountId))).body.data.orderId as string;
      const simulate = (id: string, event: object) => request(server).post(`/api/oms-demo/orders/${id}/simulate`).send(event);
      const rejected = await create();
      expect((await simulate(rejected, { type: "OrderRejected", reasonCode: "TEST", message: "rejected" })).status).toBe(200);
      expect((await request(server).get(`/api/orders/${rejected}/cash-reservation`)).body.data).toMatchObject({ remainingAmount: "0", releasedAmount: "2500000", status: "CLOSED" });
      const id = await create();
      await simulate(id, { type: "OrderAccepted" });
      await simulate(id, { type: "CancelRequested" });
      await simulate(id, { type: "CancelRejected", reasonCode: "TEST", message: "rejected" });
      expect((await request(server).get(`/api/orders/${id}/cash-reservation`)).body.data).toMatchObject({ remainingAmount: "2500000", releasedAmount: "0", status: "ACTIVE" });
      expect((await simulate(id, { type: "ExecutionReceived", executionId: "full", quantity: 100, price: 25000 })).body.data.status).toBe("FILLED");
      expect((await request(server).get(`/api/orders/${id}/cash-reservation`)).body.data).toMatchObject({ remainingAmount: "0", consumedAmount: "2500000", status: "CLOSED" });
      expect((await request(server).post("/api/oms-demo/orders").send(input(accountId))).status).toBe(409);
    } finally { await db.close(); }
  });

  it("releases only the remainder after execution while cancellation is pending", async () => {
    const db = createDatabase();
    try {
      const accountId = await fixture(db); const server = app(db);
      const id = (await request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input(accountId))).body.data.orderId;
      const simulate = (event: object) => request(server).post(`/api/oms-demo/orders/${id}/simulate`).send(event);
      await simulate({ type: "OrderAccepted" });
      await simulate({ type: "CancelRequested" });
      await simulate({ type: "ExecutionReceived", executionId: "late", quantity: 40, price: 24900 });
      expect((await simulate({ type: "CancelConfirmed" })).body.data).toMatchObject({ filledQuantity: 40, canceledQuantity: 60 });
      expect((await request(server).get(`/api/orders/${id}/cash-reservation`)).body.data).toMatchObject({ remainingAmount: "0", consumedAmount: "996000", releasedAmount: "1504000" });
    } finally { await db.close(); }
  });

  it("rejects accounts without a reconciled opening", async () => {
    const db = createDatabase();
    try {
      const server = app(db);
      const legacy = await request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input("acc-001"));
      expect(legacy.body.error.code).toBe("CASH_ACCOUNT_NOT_INITIALIZED");
      const accountId = await fixture(db);
      await db.transaction(async (c) => { await c.execute("UPDATE cash_balances SET settled_cash = 9999999 WHERE account_id = ?", [accountId]); });
      const mismatch = await request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input(accountId));
      expect(mismatch.body.error.code).toBe("CASH_RECONCILIATION_FAILED");
      const [count] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM orders WHERE account_id = ?", [accountId]);
      expect(count.n).toBe(0);
    } finally { await db.close(); }
  });

  it("rolls back creation and execution when ledger writes fail", async () => {
    const db = createDatabase();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const id = await fixture(db); const server = app(db); const failing = app(failLedger(db));
      const key = randomUUID();
      expect((await request(failing).post("/api/orders").set("Idempotency-Key", key).send(input(id))).status).toBe(500);
      const [count] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM orders WHERE account_id = ?", [id]);
      expect(count.n).toBe(0);
      const [keys] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM idempotency_requests WHERE idempotency_key = ?", [Buffer.from(key)]);
      expect(keys.n).toBe(0);
      const created = await request(server).post("/api/orders").set("Idempotency-Key", randomUUID()).send(input(id));
      const orderId = created.body.data.orderId;
      await request(server).post(`/api/oms-demo/orders/${orderId}/simulate`).send({ type: "OrderAccepted" });
      expect((await request(failing).post(`/api/oms-demo/orders/${orderId}/simulate`).send({ type: "ExecutionReceived", executionId: "fail", quantity: 40, price: 24900 })).status).toBe(500);
      const order = await request(server).get(`/api/orders/${orderId}`);
      expect(order.body.data).toMatchObject({ filledQuantity: 0, remainingQuantity: 100 });
      const reservation = await request(server).get(`/api/orders/${orderId}/cash-reservation`);
      expect(reservation.body.data.remainingAmount).toBe("2500000");
      const [balance] = await db.query<RowDataPacket[]>("SELECT reserved_cash, buy_payable FROM cash_balances WHERE account_id = ?", [id]);
      expect(balance).toMatchObject({ reserved_cash: "2500000", buy_payable: "0" });
      await request(server).post(`/api/oms-demo/orders/${orderId}/simulate`).send({ type: "CancelRequested" });
      expect((await request(failing).post(`/api/oms-demo/orders/${orderId}/simulate`).send({ type: "CancelConfirmed" })).status).toBe(500);
      expect((await request(server).get(`/api/orders/${orderId}`)).body.data).toMatchObject({ status: "NEW", cancelRequestStatus: "PENDING", remainingQuantity: 100 });
      expect((await request(server).get(`/api/orders/${orderId}/cash-reservation`)).body.data.remainingAmount).toBe("2500000");
    } finally { log.mockRestore(); await db.close(); }
  });
});
