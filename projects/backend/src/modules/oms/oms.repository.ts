import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApplicationError } from "../../errors/application-error.js";
import type { Database } from "../../infrastructure/database.js";
import { applyCashEvent, hasOpening, isExecutionReplay, lockBalance, lockReservation } from "../cash/cash.repository.js";
import type { Order, OmsRepository, RecordedEvent, OrderEvent } from "./oms.types.js";

type OrderRow = RowDataPacket & Order;
type EventRow = RowDataPacket & {
  id: string; orderId: string; eventSequence: number; eventType: OrderEvent["type"];
  fromStatus: Order["status"] | null; toStatus: Order["status"]; reasonCode: string | null;
  payload: string | object; occurredAt: Date; recordedAt: Date;
};

export const orderSelect = `SELECT id, account_id AS accountId, security_id AS securityId, side,
  order_type AS orderType, price, quantity, filled_quantity AS filledQuantity,
  remaining_quantity AS remainingQuantity, canceled_quantity AS canceledQuantity,
  status, cancel_request_status AS cancelRequestStatus, version FROM orders WHERE id = ?`;

export class MySqlOmsRepository implements OmsRepository {
  public constructor(private readonly database: Database) {}

  public async create(order: Order, event: RecordedEvent): Promise<void> {
    try {
      await this.database.transaction(async (connection) => {
        await lockBalance(connection, order.accountId);
        if (await hasOpening(connection, order.accountId)) {
          throw new ApplicationError(409, "CASH_ORDER_REQUIRES_API", "Tài khoản này phải đặt lệnh qua API giữ tiền.");
        }
        await connection.execute(`INSERT INTO orders
          (id, account_id, security_id, side, order_type, price, quantity, filled_quantity,
           remaining_quantity, canceled_quantity, status, cancel_request_status, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order.id, order.accountId, order.securityId, order.side, order.orderType, order.price,
          order.quantity, order.filledQuantity, order.remainingQuantity, order.canceledQuantity,
          order.status, order.cancelRequestStatus, order.version]);
        await insertEvent(connection, event);
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_NO_REFERENCED_ROW_2") {
        throw new ApplicationError(400, "INVALID_ORDER_REFERENCE", "Tài khoản hoặc chứng khoán không tồn tại.");
      }
      throw error;
    }
  }

  public async find(id: string): Promise<Order | null> {
    const rows = await this.database.query<OrderRow[]>(orderSelect, [id]);
    return rows[0] ?? null;
  }

  public async events(id: string): Promise<RecordedEvent[] | null> {
    return this.database.transaction(async (connection) => {
      const [orders] = await connection.execute<OrderRow[]>(orderSelect, [id]);
      if (!orders[0]) return null;
      const [rows] = await connection.execute<EventRow[]>(`SELECT id, order_id AS orderId,
        event_sequence AS eventSequence, event_type AS eventType, from_status AS fromStatus,
        to_status AS toStatus, reason_code AS reasonCode, payload, occurred_at AS occurredAt,
        recorded_at AS recordedAt FROM order_events WHERE order_id = ? ORDER BY event_sequence`, [id]);
      return rows.map((row) => ({
        id: row.id, orderId: row.orderId, eventSequence: row.eventSequence,
        fromStatus: row.fromStatus, toStatus: row.toStatus, occurredAt: row.occurredAt.toISOString(),
        recordedAt: row.recordedAt.toISOString(),
        event: { type: row.eventType, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
          ...(row.reasonCode ? { reasonCode: row.reasonCode } : {}) } as OrderEvent,
      }));
    });
  }

  public async apply(id: string, update: (order: Order) => { order: Order; event: RecordedEvent }, incoming?: OrderEvent): Promise<Order | null> {
    return this.database.transaction(async (connection) => {
      const [initial] = await connection.execute<OrderRow[]>(orderSelect, [id]);
      if (!initial[0]) return null;
      await lockBalance(connection, initial[0].accountId);
      const [rows] = await connection.execute<OrderRow[]>(`${orderSelect} FOR UPDATE`, [id]);
      if (!rows[0]) return null;
      if (rows[0].accountId !== initial[0].accountId) throw new Error("Order account changed");
      const reservation = await lockReservation(connection, rows[0]);
      if (!reservation && await hasOpening(connection, rows[0].accountId)) {
        throw new ApplicationError(409, "CASH_RESERVATION_MISSING", "Lệnh không có khoản giữ tiền.");
      }
      if (reservation && !incoming) throw new Error("Cash event is required");
      if (reservation && incoming && await isExecutionReplay(connection, rows[0], incoming)) return rows[0];
      const { order, event } = update(rows[0]);
      await connection.execute(`UPDATE orders SET filled_quantity = ?, remaining_quantity = ?,
        canceled_quantity = ?, status = ?, cancel_request_status = ?, version = ? WHERE id = ?`,
      [order.filledQuantity, order.remainingQuantity, order.canceledQuantity, order.status,
        order.cancelRequestStatus, order.version, id]);
      await insertEvent(connection, event);
      if (reservation) await applyCashEvent(connection, rows[0], event.event, reservation, event.occurredAt);
      return order;
    });
  }
}

export async function insertEvent(connection: PoolConnection, record: RecordedEvent): Promise<void> {
  await connection.execute(`INSERT INTO order_events (id, order_id, event_sequence, event_type,
    from_status, to_status, reason_code, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [record.id, record.orderId, record.eventSequence, record.event.type, record.fromStatus, record.toStatus,
    "reasonCode" in record.event ? record.event.reasonCode : null,
    JSON.stringify(record.event.payload), new Date(record.occurredAt)]);
}
