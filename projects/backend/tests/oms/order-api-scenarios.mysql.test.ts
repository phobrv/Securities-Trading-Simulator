import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { createServer } from "node:net";
import request from "supertest";
import mysql from "mysql2/promise";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createDatabase, type Database } from "../../src/infrastructure/database.js";
import { MySqlOmsRepository } from "../../src/modules/oms/oms.repository.js";
import { OmsService } from "../../src/modules/oms/oms.service.js";
import { OrderApiService } from "../../src/modules/oms/order-api.service.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";
import { deleteTestOrder, orderApiApp, orderApiService, orderInput } from "../test-support/order-api.js";

const mysqlDescribe = process.env.OMS_MYSQL_TEST === "true" ? describe : describe.skip;
type Count = RowDataPacket & { count: number };

async function keyCount(database: Database, key: string): Promise<number> {
  return (await database.query<Count[]>("SELECT COUNT(*) AS count FROM idempotency_requests WHERE idempotency_key = ?", [Buffer.from(key)]))[0].count;
}

function failStatement(database: Database, target: string, capture: { id: string }): Database {
  return {
    ...database,
    transaction: (work) => database.transaction((connection) => {
      const proxy = new Proxy(connection, {
        get(object, property) {
          if (property === "execute") return async (sql: string, parameters?: unknown[]) => {
            if (sql.startsWith("INSERT INTO orders")) capture.id = String(parameters?.[0]);
            if (sql.startsWith(target)) throw new Error("injected database write failure");
            return (object.execute as (query: string, values?: unknown[]) => Promise<unknown>).call(object, sql, parameters);
          };
          const value = Reflect.get(object, property, object);
          return typeof value === "function" ? value.bind(object) : value;
        },
      }) as PoolConnection;
      return work(proxy);
    }),
  };
}

mysqlDescribe("order API: failures and business rules", () => {
  beforeAll(() => {
    if (!process.env.DB_NAME || !process.env.DB_NAME.toLowerCase().includes("test")) {
      throw new Error("Set DB_NAME explicitly to a disposable database whose name includes 'test'.");
    }
  });
  it("allows only one winner when concurrent requests reuse a key with different payloads", async () => {
    const database = createDatabase();
    const app = orderApiApp(orderApiService(database, randomUUID()));
    const key = randomUUID();
    let id = "";
    try {
      const results = await Promise.all([
        request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput),
        request(app).post("/api/orders").set("Idempotency-Key", key).send({ ...orderInput, quantity: 101 }),
      ]);
      expect(results.map((response) => response.status).sort()).toEqual([202, 409]);
      const success = results.find((response) => response.status === 202)!;
      const conflict = results.find((response) => response.status === 409)!;
      id = success.body.data.orderId;
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(success.headers["x-request-id"]).not.toBe(conflict.headers["x-request-id"]);
      expect(await keyCount(database, key)).toBe(1);
      expect((await database.query<Count[]>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND event_type = 'OrderReceived'", [id]))[0].count).toBe(1);
    } finally {
      if (id) await deleteTestOrder(database, id);
      await database.close();
    }
  });

  it.each(["INSERT INTO order_events", "UPDATE idempotency_requests"])("rolls back on %s failure", async (target) => {
    const database = createDatabase();
    const capture = { id: "" };
    const key = randomUUID();
    const app = orderApiApp(orderApiService(failStatement(database, target, capture), randomUUID()));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      expect(response.status).toBe(500);
      expect(response.body.error).toEqual({ code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi không mong muốn." });
      expect(capture.id).not.toBe("");
      expect(await keyCount(database, key)).toBe(0);
      expect((await database.query<Count[]>("SELECT COUNT(*) AS count FROM orders WHERE id = ?", [capture.id]))[0].count).toBe(0);
      expect((await database.query<Count[]>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?", [capture.id]))[0].count).toBe(0);
    } finally { log.mockRestore(); await database.close(); }
  });

  it("checks validation and business failures without persisting keys or changing assets", async () => {
    const database = createDatabase();
    const requester = randomUUID();
    const app = orderApiApp(orderApiService(database, requester));
    const closed = orderApiApp(orderApiService(database, requester, "2026-10-20T20:00:00Z"));
    const blockedId = `blocked-${randomUUID().slice(0, 8)}`;
    let orderId = "";
    try {
      await database.transaction(async (connection) => {
        await connection.execute("INSERT INTO accounts (id, customer_ref, status) VALUES (?, ?, 'BLOCKED')", [blockedId, blockedId]);
        await connection.execute("INSERT INTO cash_balances (account_id, settled_cash) VALUES (?, 10000000)", [blockedId]);
      });
      const assets = async () => ({
        cash: await database.query<RowDataPacket[]>("SELECT * FROM cash_balances WHERE account_id = ?", ["acc-001"]),
        positions: await database.query<RowDataPacket[]>("SELECT * FROM positions WHERE account_id = ?", ["acc-001"]),
        reservations: await database.query<RowDataPacket[]>("SELECT * FROM security_reservations WHERE account_id = ? ORDER BY id", ["acc-001"]),
      });
      const before = await assets();
      const cases = [
        { input: { ...orderInput, accountId: "missing" }, code: "ACCOUNT_NOT_FOUND", status: 404, app },
        { input: { ...orderInput, accountId: blockedId }, code: "ACCOUNT_NOT_ACTIVE", status: 422, app },
        { input: { ...orderInput, securityId: "missing" }, code: "SECURITY_NOT_FOUND", status: 404, app },
        { input: { ...orderInput, securityId: "sec-002" }, code: "SECURITY_NOT_TRADABLE", status: 422, app },
        { input: { ...orderInput, securityId: "sec-003" }, code: "SECURITY_NOT_TRADABLE", status: 422, app },
        { input: { ...orderInput, price: 25050 }, code: "INVALID_PRICE", status: 422, app },
        { input: { ...orderInput, quantity: 0 }, code: "INVALID_REQUEST", status: 400, app },
        { input: { ...orderInput, quantity: 1000 }, code: "INSUFFICIENT_CASH", status: 422, app },
        { input: { ...orderInput, side: "SELL", quantity: 1000 }, code: "INSUFFICIENT_SECURITIES", status: 422, app },
        { input: orderInput, code: "INVALID_SESSION", status: 422, app: closed },
      ];
      for (const item of cases) {
        const key = randomUUID();
        const result = await request(item.app).post("/api/orders").set("Idempotency-Key", key).send(item.input);
        expect(result.status).toBe(item.status);
        expect(result.body.error.code).toBe(item.code);
        expect(result.body.requestId).toBe(result.headers["x-request-id"]);
        expect(await keyCount(database, key)).toBe(0);
      }
      const retryKey = randomUUID();
      const rejected = await request(closed).post("/api/orders").set("Idempotency-Key", retryKey).send(orderInput);
      expect(rejected.body.error.code).toBe("INVALID_SESSION");
      const result = await request(app).post("/api/orders").set("Idempotency-Key", retryKey).send(orderInput);
      expect(result.status).toBe(202);
      orderId = result.body.data.orderId;
      const oms = new OmsService(new MySqlOmsRepository(database), new FixedClock(new Date("2026-10-20T03:00:00Z")));
      await oms.apply(orderId, { type: "OrderAccepted", payload: {} });
      const cancel = await request(app).post(`/api/orders/${orderId}/cancel`).set("Idempotency-Key", randomUUID()).send({});
      expect(cancel.status).toBe(202);
      expect(await assets()).toEqual(before);
    } finally {
      if (orderId) await deleteTestOrder(database, orderId);
      await database.transaction(async (connection) => {
        await connection.execute("DELETE FROM cash_balances WHERE account_id = ?", [blockedId]);
        await connection.execute("DELETE FROM accounts WHERE id = ?", [blockedId]);
      });
      await database.close();
    }
  });

  it("rejects cancellation in pending and terminal states without recording an event or key", async () => {
    const database = createDatabase();
    const clock = new FixedClock(new Date("2026-10-20T03:00:00Z"));
    const oms = new OmsService(new MySqlOmsRepository(database), clock);
    const app = orderApiApp(orderApiService(database, randomUUID()));
    const ids: string[] = [];
    try {
      for (const status of ["PENDING_NEW", "REJECTED", "FILLED", "CANCELED"] as const) {
        const order = await oms.create({ ...orderInput, price: "25000" });
        ids.push(order.id);
        if (status === "REJECTED") await oms.apply(order.id, { type: "OrderRejected", reasonCode: "TEST", payload: { message: "test" } });
        if (status === "FILLED" || status === "CANCELED") await oms.apply(order.id, { type: "OrderAccepted", payload: {} });
        if (status === "FILLED") await oms.apply(order.id, { type: "ExecutionReceived", payload: { executionId: randomUUID(), quantity: 100, price: "25000" } });
        if (status === "CANCELED") {
          await oms.apply(order.id, { type: "CancelRequested", payload: {} });
          await oms.apply(order.id, { type: "CancelConfirmed", payload: {} });
        }
        const count = (await oms.events(order.id)).length;
        const key = randomUUID();
        const result = await request(app).post(`/api/orders/${order.id}/cancel`).set("Idempotency-Key", key).send({});
        expect(result.status).toBe(409);
        expect(result.body.error.code).toBe("ORDER_NOT_CANCELABLE");
        expect(await keyCount(database, key)).toBe(0);
        expect(await oms.events(order.id)).toHaveLength(count);
      }
    } finally {
      for (const id of ids) await deleteTestOrder(database, id);
      await database.close();
    }
  });

  it("retries after the response times out following commit", async () => {
    const database = createDatabase();
    const service = orderApiService(database, randomUUID());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let committed!: (id: string) => void;
    const committedOrder = new Promise<string>((resolve) => { committed = resolve; });
    const delayed = { create: async (...args: Parameters<OrderApiService["create"]>) => {
      const result = await service.create(...args);
      committed(result.body.data.orderId);
      await gate;
      return result;
    } } as unknown as OrderApiService;
    const key = randomUUID();
    let id = "";
    try {
      const first = request(orderApiApp(delayed)).post("/api/orders").set("Idempotency-Key", key).send(orderInput)
        .timeout({ deadline: 500 }).then(() => null, (error: Error) => error);
      id = await committedOrder;
      expect(await first).toBeInstanceOf(Error);
      const app = orderApiApp(service);
      const retry = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      const again = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      expect(retry.body.data.orderId).toBe(id);
      expect(retry.headers["idempotency-replayed"]).toBe("true");
      expect(retry.headers["x-request-id"]).not.toBe(again.headers["x-request-id"]);
      expect((await database.query<Count[]>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND event_type = 'OrderReceived'", [id]))[0].count).toBe(1);
      expect(await keyCount(database, key)).toBe(1);
    } finally {
      release();
      if (id) await deleteTestOrder(database, id);
      await database.close();
    }
  }, 10000);

  it("replays the committed response after restarting the HTTP process", async () => {
    const database = createDatabase();
    const requester = randomUUID();
    const key = randomUUID();
    let child: ChildProcessWithoutNullStreams | undefined;
    let id = "";
    try {
      let server = await startServer(requester);
      child = server.child;
      const send = (port: number) => fetch(`http://127.0.0.1:${port}/api/orders`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(orderInput),
      });
      const initial = await send(server.port);
      expect(initial.status).toBe(202);
      const body = await initial.json() as { data: { orderId: string } };
      id = body.data.orderId;
      await stopServer(child);
      child = undefined;
      server = await startServer(requester);
      child = server.child;
      const replay = await send(server.port);
      expect(replay.status).toBe(202);
      expect(replay.headers.get("idempotency-replayed")).toBe("true");
      expect(await replay.json()).toEqual(body);
      expect((await database.query<Count[]>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND event_type = 'OrderReceived'", [id]))[0].count).toBe(1);
    } finally {
      if (child) await stopServer(child);
      if (id) await deleteTestOrder(database, id);
      await database.close();
    }
  }, 20000);

  it("returns 503 on a real idempotency lock timeout and allows retry after rollback", async () => {
    const database = createDatabase();
    const requester = randomUUID();
    const key = randomUUID();
    const scope = createHash("sha256").update(JSON.stringify([requester, "acc-001", "CREATE_ORDER"])).digest();
    let acquired!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => { acquired = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const holder = database.transaction(async (connection) => {
      await connection.execute("INSERT INTO idempotency_requests (scope_hash, idempotency_key, request_hash) VALUES (?, ?, ?)", [scope, Buffer.from(key), Buffer.alloc(32)]);
      acquired();
      await gate;
      throw new Error("release test lock by rollback");
    }).catch(() => undefined);
    let id = "";
    try {
      await locked;
      const app = orderApiApp(orderApiService(database, requester));
      const failed = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      expect(failed.status).toBe(503);
      expect(failed.body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(failed.body)).not.toMatch(/INSERT|SQL|innodb/i);
      release();
      await holder;
      expect(await keyCount(database, key)).toBe(0);
      const retry = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      expect(retry.status).toBe(202);
      id = retry.body.data.orderId;
    } finally {
      release();
      await holder;
      if (id) await deleteTestOrder(database, id);
      await database.close();
    }
  }, 15000);

  it("maps a real MySQL deadlock to 503 without committing the request", async () => {
    const database = createDatabase();
    let holderReady!: () => void;
    let appReady!: () => void;
    let holderWaiting!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { holderReady = resolve; });
    const appLocked = new Promise<void>((resolve) => { appReady = resolve; });
    const waiting = new Promise<void>((resolve) => { holderWaiting = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const holder = database.transaction(async (connection) => {
      await connection.execute("UPDATE accounts SET status = 'BLOCKED' WHERE id = 'acc-002'");
      await connection.execute("UPDATE securities SET trading_status = 'DELISTED' WHERE id = 'sec-002'");
      holderReady();
      await appLocked;
      const pending = connection.execute("SELECT id FROM accounts WHERE id = 'acc-001' FOR UPDATE");
      holderWaiting();
      await pending;
      await gate;
      throw new Error("rollback test holder");
    }).catch(() => undefined);
    const deadlockingDatabase: Database = {
      ...database,
      transaction: (work) => database.transaction(async (connection) => {
        await connection.execute("SELECT id FROM accounts WHERE id = 'acc-001' FOR UPDATE");
        appReady();
        await waiting;
        await connection.execute("SELECT id FROM accounts WHERE id = 'acc-002' FOR UPDATE");
        return work(connection);
      }),
    };
    const key = randomUUID();
    try {
      await ready;
      const app = orderApiApp(orderApiService(deadlockingDatabase, randomUUID()));
      const response = await request(app).post("/api/orders").set("Idempotency-Key", key).send(orderInput);
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(response.body)).not.toMatch(/SELECT|deadlock|accounts/i);
      expect(await keyCount(database, key)).toBe(0);
    } finally {
      appReady();
      release();
      await holder;
      await database.close();
    }
  }, 15000);

  it("returns a safe 503 when a real MySQL TCP connection is refused", async () => {
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    const database = createDatabase();
    const disconnected: Database = {
      ...database,
      transaction: async () => {
        const connection = await mysql.createConnection({ host: "127.0.0.1", port, user: "test", connectTimeout: 1000 });
        await connection.end();
        throw new Error("Unexpected connection");
      },
    };
    try {
      const response = await request(orderApiApp(orderApiService(disconnected, randomUUID())))
        .post("/api/orders").set("Idempotency-Key", randomUUID()).send(orderInput);
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(response.body.requestId).toBe(response.headers["x-request-id"]);
      expect(JSON.stringify(response.body)).not.toMatch(/127\.0\.0\.1|ECONNREFUSED|password/i);
    } finally { await database.close(); }
  });
});

async function startServer(requester: string): Promise<{ child: ChildProcessWithoutNullStreams; port: number }> {
  const child = spawn(process.execPath, ["--import", "tsx", "tests/test-support/order-api-server.ts"], {
    env: { ...process.env, TEST_REQUESTER: requester }, stdio: "pipe",
  });
  const lines = createInterface({ input: child.stdout });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 10000);
      lines.on("line", (line) => {
        const match = /^READY (\d+)$/.exec(line);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${stderr}`)); });
    });
    return { child, port };
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  } finally { lines.close(); }
}

async function stopServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}
