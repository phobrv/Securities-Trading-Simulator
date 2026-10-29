import type { RowDataPacket } from "mysql2/promise";
import { ApplicationError } from "../../errors/application-error.js";
import type { Database } from "../../infrastructure/database.js";

export class CashReadRepository {
  public constructor(private readonly database: Database) {}

  public async reservation(orderId: string) {
    const rows = await this.database.query<RowDataPacket[]>(`SELECT id, account_id AS accountId, order_id AS orderId,
      initial_amount AS initialAmount, remaining_amount AS remainingAmount, consumed_amount AS consumedAmount,
      released_amount AS releasedAmount, status FROM cash_reservations WHERE order_id = ?`, [orderId]);
    if (rows[0]) return rows[0];
    const orders = await this.database.query<RowDataPacket[]>("SELECT id FROM orders WHERE id = ?", [orderId]);
    if (!orders.length) throw new ApplicationError(404, "ORDER_NOT_FOUND", "Không tìm thấy lệnh.");
    throw new ApplicationError(404, "CASH_RESERVATION_NOT_FOUND", "Lệnh không có khoản giữ tiền.");
  }

  public async ledger(accountId: string) {
    const accounts = await this.database.query<RowDataPacket[]>("SELECT id FROM accounts WHERE id = ?", [accountId]);
    if (!accounts.length) throw new ApplicationError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");
    const rows = await this.database.query<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id, account_id AS accountId, order_id AS orderId,
      entry_type AS entryType, business_key AS businessKey, delta_settled_cash AS deltaSettledCash,
      delta_reserved_cash AS deltaReservedCash, delta_buy_payable AS deltaBuyPayable,
      delta_blocked_cash AS deltaBlockedCash, delta_pending_receivable AS deltaPendingReceivable,
      payload, occurred_at AS occurredAt FROM cash_ledger_entries WHERE account_id = ? ORDER BY id`, [accountId]);
    return rows.map((row) => ({ ...row, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload }));
  }
}
