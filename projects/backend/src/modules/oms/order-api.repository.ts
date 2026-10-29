import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Database } from "../../infrastructure/database.js";
import { ApplicationError } from "../../errors/application-error.js";
import { isInfrastructureUnavailable } from "../../errors/infrastructure-error.js";
import type { Clock } from "../../shared/clock/clock.js";
import { applyOrderEvent } from "./oms.reducer.js";
import { insertEvent, orderSelect } from "./oms.repository.js";
import type { Order, OrderEvent, OrderInput, RecordedEvent } from "./oms.types.js";

type Key = { scope: Buffer; key: Buffer; hash: Buffer };
type Result = { status: number; body: { data: OrderResponse }; replayed: boolean };
export type OrderResponse = Omit<Order, "id"> & { orderId: string };
type Stored = RowDataPacket & { requestHash: Buffer; status: number | null; body: string | Result["body"] | null };
type OrderRow = RowDataPacket & Order;
class DuplicateIntent extends Error {}

export class OrderApiRepository {
  public constructor(private readonly database: Database, private readonly clock: Clock) {}

  public async find(id: string): Promise<Order | null> {
    const rows = await this.database.query<OrderRow[]>(orderSelect, [id]);
    return rows[0] ?? null;
  }

  public async execute(key: Key, work: (connection: PoolConnection) => Promise<Order>): Promise<Result> {
    try {
      return await this.database.transaction(async (connection) => {
        const [settings] = await connection.query<(RowDataPacket & { timeout: number })[]>("SELECT @@SESSION.innodb_lock_wait_timeout AS timeout");
        await connection.query("SET innodb_lock_wait_timeout = 5");
        try {
          try {
            await connection.execute("INSERT INTO idempotency_requests (scope_hash, idempotency_key, request_hash) VALUES (?, ?, ?)",
              [key.scope, key.key, key.hash]);
          } catch (error) {
            if (isDuplicate(error)) throw new DuplicateIntent();
            throw error;
          }
          const order = await work(connection);
          const { id, ...rest } = order;
          const body = { data: { orderId: id, ...rest } };
          await connection.execute(`UPDATE idempotency_requests SET order_id = ?, http_status = 202, response_body = ?
            WHERE scope_hash = ? AND idempotency_key = ?`, [id, JSON.stringify(body), key.scope, key.key]);
          return { status: 202, body, replayed: false };
        } finally {
          await connection.query(`SET innodb_lock_wait_timeout = ${Number(settings[0].timeout)}`);
        }
      });
    } catch (error) {
      if (error instanceof DuplicateIntent) return this.replay(key);
      if (isInfrastructureUnavailable(error)) throw new ApplicationError(503, "SERVICE_UNAVAILABLE", "Hạ tầng chưa sẵn sàng; hãy thử lại cùng khóa.");
      throw error;
    }
  }

  private async replay(key: Key): Promise<Result> {
    const rows = await this.database.query<Stored[]>(`SELECT request_hash AS requestHash, http_status AS status,
      response_body AS body FROM idempotency_requests WHERE scope_hash = ? AND idempotency_key = ?`, [key.scope, key.key]);
    const row = rows[0];
    if (!row || !row.status || !row.body) throw new ApplicationError(503, "SERVICE_UNAVAILABLE", "Không thể đọc kết quả yêu cầu.");
    if (!row.requestHash.equals(key.hash)) throw new ApplicationError(409, "IDEMPOTENCY_KEY_REUSED", "Khóa đã được dùng cho một yêu cầu có nội dung khác.");
    return { status: row.status, body: typeof row.body === "string" ? JSON.parse(row.body) : row.body, replayed: true };
  }

  public async create(connection: PoolConnection, input: OrderInput): Promise<Order> {
    const event: OrderEvent = { type: "OrderReceived", payload: input };
    const order = applyOrderEvent(null, event, randomUUID());
    await connection.execute(`INSERT INTO orders (id, account_id, security_id, side, order_type, price, quantity,
      filled_quantity, remaining_quantity, canceled_quantity, status, cancel_request_status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [order.id, order.accountId, order.securityId, order.side,
      order.orderType, order.price, order.quantity, order.filledQuantity, order.remainingQuantity,
      order.canceledQuantity, order.status, order.cancelRequestStatus, order.version]);
    await insertEvent(connection, this.record(event, null, order));
    return order;
  }

  public async cancel(connection: PoolConnection, id: string): Promise<Order> {
    const [rows] = await connection.execute<OrderRow[]>(`${orderSelect} FOR UPDATE`, [id]);
    const previous = rows[0];
    if (!previous) throw new ApplicationError(404, "ORDER_NOT_FOUND", "Không tìm thấy lệnh.");
    if (previous.status !== "NEW" && previous.status !== "PARTIALLY_FILLED") {
      throw new ApplicationError(409, "ORDER_NOT_CANCELABLE", "Lệnh không thể nhận yêu cầu hủy.");
    }
    if (previous.cancelRequestStatus === "PENDING") {
      throw new ApplicationError(409, "CANCEL_ALREADY_PENDING", "Lệnh đã có yêu cầu hủy đang chờ.");
    }
    const event: OrderEvent = { type: "CancelRequested", payload: {} };
    const order = applyOrderEvent(previous, event, id);
    await connection.execute("UPDATE orders SET cancel_request_status = ?, version = ? WHERE id = ?", [order.cancelRequestStatus, order.version, id]);
    await insertEvent(connection, this.record(event, previous, order));
    return order;
  }

  private record(event: OrderEvent, previous: Order | null, order: Order): RecordedEvent {
    return { id: randomUUID(), orderId: order.id, eventSequence: order.version, fromStatus: previous?.status ?? null,
      toStatus: order.status, occurredAt: this.clock.now().toISOString(), event };
  }
}

function isDuplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY" &&
    "message" in error && typeof error.message === "string" && error.message.includes("uq_idempotency_scope_key");
}
