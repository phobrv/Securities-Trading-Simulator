import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Order, OrderEvent } from "../oms/oms.types.js";
import { buyCost } from "../portfolio/cost-basis.calculator.js";
import { ApplicationError } from "../../errors/application-error.js";

export async function applyBuyExecution(
  connection: PoolConnection,
  order: Order,
  event: OrderEvent,
  occurredAt: string,
): Promise<void> {
  if (event.type !== "ExecutionReceived" || order.side !== "BUY") return;
  const [legacy] = await connection.execute<RowDataPacket[]>(
    `SELECT l.id FROM cash_ledger_entries l JOIN orders o ON o.id = l.order_id
     LEFT JOIN position_movements m ON m.account_id = l.account_id AND m.security_id = o.security_id AND m.business_key = l.business_key
     WHERE l.account_id = ? AND o.security_id = ? AND l.entry_type = 'EXECUTION'
       AND l.business_key <> ? AND m.id IS NULL LIMIT 1`,
    [
      order.accountId,
      order.securityId,
      `EXECUTION:${order.id}:${event.payload.executionId}`,
    ],
  );
  if (legacy.length)
    throw new ApplicationError(
      409,
      "POSITION_HISTORY_INCOMPLETE",
      "Lịch sử vị thế chưa đầy đủ; cần backfill riêng trước khi xử lý execution mới.",
    );
  await connection.execute(
    `INSERT INTO positions (account_id, security_id, total_cost, realized_pnl)
    VALUES (?, ?, 0, 0) ON DUPLICATE KEY UPDATE account_id = account_id`,
    [order.accountId, order.securityId],
  );
  const [rows] = await connection.execute<
    (RowDataPacket & { totalCost: string | null })[]
  >(
    "SELECT total_cost AS totalCost FROM positions WHERE account_id = ? AND security_id = ? FOR UPDATE",
    [order.accountId, order.securityId],
  );
  const { price, quantity, executionId } = event.payload;
  const delta = buyCost(0n, BigInt(price), quantity);
  const total =
    rows[0].totalCost === null
      ? null
      : buyCost(BigInt(rows[0].totalCost), BigInt(price), quantity).toString();
  await connection.execute(
    "UPDATE positions SET pending_buy_quantity = pending_buy_quantity + ?, total_cost = ? WHERE account_id = ? AND security_id = ?",
    [quantity, total, order.accountId, order.securityId],
  );
  await connection.execute(
    `INSERT INTO position_movements (account_id, security_id, order_id, execution_id, movement_type,
    business_key, delta_economic_quantity, delta_total_cost, payload, occurred_at) VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?)`,
    [
      order.accountId,
      order.securityId,
      order.id,
      executionId,
      `EXECUTION:${order.id}:${executionId}`,
      quantity,
      delta.toString(),
      JSON.stringify(event.payload),
      new Date(occurredAt),
    ],
  );
}
