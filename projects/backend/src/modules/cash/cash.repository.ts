import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApplicationError } from "../../errors/application-error.js";
import type { Order, OrderEvent } from "../oms/oms.types.js";
import { executionAmounts, reserveAmount } from "./cash.calculator.js";

type Balance = RowDataPacket & { settled: string; reserved: string; payable: string; blocked: string; receivable: string };
type Reservation = RowDataPacket & { accountId: string; remaining: string; consumed: string; released: string };

export async function lockBalance(connection: PoolConnection, accountId: string): Promise<Balance | null> {
  const [rows] = await connection.execute<Balance[]>(`SELECT settled_cash AS settled, reserved_cash AS reserved,
    buy_payable AS payable, blocked_cash AS blocked, pending_receivable AS receivable FROM cash_balances WHERE account_id = ? FOR UPDATE`, [accountId]);
  return rows[0] ?? null;
}

export async function hasOpening(connection: PoolConnection, accountId: string): Promise<boolean> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT id FROM cash_ledger_entries WHERE account_id = ? AND entry_type = 'OPENING' AND business_key = ? FOR UPDATE",
    [accountId, `OPENING:${accountId}:v1`]);
  return rows.length > 0;
}

export async function requireFunds(connection: PoolConnection, accountId: string, price: string, quantity: number): Promise<bigint> {
  const balance = await lockBalance(connection, accountId);
  if (!balance || !(await hasOpening(connection, accountId))) {
    throw new ApplicationError(422, "CASH_ACCOUNT_NOT_INITIALIZED", "Tài khoản chưa được khởi tạo sổ cái tiền.");
  }
  const [sums] = await connection.execute<(RowDataPacket & Balance)[]>(`SELECT
    COALESCE(SUM(delta_settled_cash), 0) AS settled, COALESCE(SUM(delta_reserved_cash), 0) AS reserved,
    COALESCE(SUM(delta_buy_payable), 0) AS payable, COALESCE(SUM(delta_blocked_cash), 0) AS blocked,
    COALESCE(SUM(delta_pending_receivable), 0) AS receivable FROM cash_ledger_entries WHERE account_id = ?`, [accountId]);
  const [holds] = await connection.execute<(RowDataPacket & { total: string })[]>(
    "SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM cash_reservations WHERE account_id = ?", [accountId]);
  if ((["settled", "reserved", "payable", "blocked", "receivable"] as const).some((name) => BigInt(balance[name]) !== BigInt(sums[0][name])) ||
      BigInt(balance.reserved) !== BigInt(holds[0].total)) {
    throw new ApplicationError(409, "CASH_RECONCILIATION_FAILED", "Số dư tiền không khớp sổ cái hoặc khoản giữ.");
  }
  const amount = reserveAmount(price, quantity);
  const available = BigInt(balance.settled) - BigInt(balance.reserved) - BigInt(balance.payable) - BigInt(balance.blocked);
  if (available < amount) throw new ApplicationError(422, "INSUFFICIENT_CASH", "Tiền khả dụng không đủ.");
  return amount;
}

async function ledger(connection: PoolConnection, order: Order, type: "RESERVE" | "EXECUTION" | "RELEASE",
  key: string, reserved: bigint, payable: bigint, payload: object, occurredAt: string): Promise<void> {
  await connection.execute(`INSERT INTO cash_ledger_entries (account_id, order_id, entry_type, business_key,
    delta_reserved_cash, delta_buy_payable, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [order.accountId, order.id, type, key, reserved.toString(), payable.toString(), JSON.stringify(payload), new Date(occurredAt)]);
}

export async function createReservation(connection: PoolConnection, order: Order, amount: bigint, occurredAt: string): Promise<void> {
  await connection.execute(`INSERT INTO cash_reservations (id, account_id, order_id, initial_amount, remaining_amount, status)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE')`, [randomUUID(), order.accountId, order.id, amount.toString(), amount.toString()]);
  await connection.execute("UPDATE cash_balances SET reserved_cash = reserved_cash + ? WHERE account_id = ?", [amount.toString(), order.accountId]);
  await ledger(connection, order, "RESERVE", `RESERVE:${order.id}`, amount, 0n, {}, occurredAt);
}

export async function lockReservation(connection: PoolConnection, order: Order): Promise<Reservation | null> {
  const [rows] = await connection.execute<Reservation[]>(`SELECT account_id AS accountId, remaining_amount AS remaining,
    consumed_amount AS consumed, released_amount AS released FROM cash_reservations WHERE order_id = ? FOR UPDATE`, [order.id]);
  const reservation = rows[0];
  if (reservation && reservation.accountId !== order.accountId) throw new Error("Reservation account mismatch");
  return reservation ?? null;
}

export async function isExecutionReplay(connection: PoolConnection, order: Order, event: OrderEvent): Promise<boolean> {
  if (event.type !== "ExecutionReceived") return false;
  const [rows] = await connection.execute<(RowDataPacket & { payload: string | typeof event.payload })[]>(
    "SELECT payload FROM cash_ledger_entries WHERE account_id = ? AND business_key = ? FOR UPDATE",
    [order.accountId, `EXECUTION:${order.id}:${event.payload.executionId}`]);
  if (!rows[0]) return false;
  const stored = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
  if (stored.executionId !== event.payload.executionId || stored.quantity !== event.payload.quantity ||
      stored.price !== event.payload.price) {
    throw new ApplicationError(409, "EXECUTION_ID_REUSED", "Execution đã được sử dụng với nội dung khác.");
  }
  return true;
}

export async function applyCashEvent(connection: PoolConnection, order: Order, event: OrderEvent,
  reservation: Reservation, occurredAt: string): Promise<void> {
  let reserved: bigint;
  let payable = 0n;
  let released: bigint;
  let type: "EXECUTION" | "RELEASE";
  let key: string;
  if (event.type === "ExecutionReceived") {
    const amounts = executionAmounts(order.price, event.payload.price, event.payload.quantity);
    reserved = amounts.reserved; payable = amounts.payable; released = amounts.released;
    type = "EXECUTION"; key = `EXECUTION:${order.id}:${event.payload.executionId}`;
  } else if (event.type === "CancelConfirmed" || event.type === "OrderRejected") {
    reserved = BigInt(reservation.remaining); released = reserved;
    type = "RELEASE"; key = `RELEASE:${order.id}:${event.type === "CancelConfirmed" ? "CANCELED" : "REJECTED"}`;
  } else return;
  const remaining = BigInt(reservation.remaining) - reserved;
  if (reserved <= 0n || remaining < 0n) throw new Error("Invalid reservation amount");
  await connection.execute(`UPDATE cash_reservations SET remaining_amount = ?, consumed_amount = ?, released_amount = ?, status = ? WHERE order_id = ?`,
    [remaining.toString(), (BigInt(reservation.consumed) + payable).toString(),
      (BigInt(reservation.released) + released).toString(), remaining === 0n ? "CLOSED" : "ACTIVE", order.id]);
  await connection.execute(`UPDATE cash_balances SET reserved_cash = reserved_cash - ?, buy_payable = buy_payable + ? WHERE account_id = ?`,
    [reserved.toString(), payable.toString(), order.accountId]);
  await ledger(connection, order, type, key, -reserved, payable, event.payload, occurredAt);
}
