import type { ExecuteValues } from "mysql2";
import type { RowDataPacket } from "mysql2/promise";

import type { Database } from "../../infrastructure/database.js";

import type {
  Account,
  AccountRepository,
  AccountStatus,
  CashBalance,
  Position,
} from "./account.types.js";

type AccountRow = RowDataPacket & {
  id: string;
  status: AccountStatus;
};

type CashBalanceRow = RowDataPacket & {
  accountId: string;
  currency: string;
  settledCash: string;
  reservedCash: string;
  buyPayable: string;
  blockedCash: string;
  pendingReceivable: string;
};

type PositionRow = RowDataPacket & {
  accountId: string;
  securityId: string;
  symbol: string;
  marketCode: string;
  settledQuantity: number | string;
  pendingBuyQuantity: number | string;
  pendingSellQuantity: number | string;
  reservedQuantity: number | string;
  blockedQuantity: number | string;
};

export class MySqlAccountRepository implements AccountRepository {
  public constructor(private readonly database: Database) {}

  public async findAccount(accountId: string): Promise<Account | null> {
    const rows = await this.database.query<AccountRow[]>(
      `SELECT id, status
       FROM accounts
       WHERE id = ?`,
      [accountId],
    );
    const row = rows[0];

    return row ? { id: row.id, status: row.status } : null;
  }

  public async findCashBalance(accountId: string): Promise<CashBalance | null> {
    const rows = await this.database.query<CashBalanceRow[]>(
      `SELECT
         account_id AS accountId,
         currency,
         settled_cash AS settledCash,
         reserved_cash AS reservedCash,
         buy_payable AS buyPayable,
         blocked_cash AS blockedCash,
         pending_receivable AS pendingReceivable
       FROM cash_balances
       WHERE account_id = ?`,
      [accountId],
    );
    const row = rows[0];

    return row ? toCashBalance(row) : null;
  }

  public async findPositions(accountId: string): Promise<Position[]> {
    const rows = await this.database.query<PositionRow[]>(
      `SELECT
         p.account_id AS accountId,
         p.security_id AS securityId,
         s.symbol,
         s.market_code AS marketCode,
         p.settled_quantity AS settledQuantity,
         p.pending_buy_quantity AS pendingBuyQuantity,
         p.pending_sell_quantity AS pendingSellQuantity,
         COALESCE(reservations.reservedQuantity, 0) AS reservedQuantity,
         p.blocked_quantity AS blockedQuantity
       FROM positions AS p
       INNER JOIN securities AS s ON s.id = p.security_id
       LEFT JOIN (
         SELECT
           account_id,
           security_id,
           SUM(quantity) AS reservedQuantity
         FROM security_reservations
         WHERE status = 'ACTIVE'
         GROUP BY account_id, security_id
       ) AS reservations
         ON reservations.account_id = p.account_id
         AND reservations.security_id = p.security_id
       WHERE p.account_id = ?
       ORDER BY p.security_id`,
      [accountId],
    );

    return rows.map(toPosition);
  }
}

function toCashBalance(row: CashBalanceRow): CashBalance {
  if (row.currency !== "VND") {
    throw new AccountRepositoryDataError("Tiền tệ tài khoản không hợp lệ.");
  }

  return {
    accountId: row.accountId,
    currency: "VND",
    settledCash: parseMoney(row.settledCash),
    reservedCash: parseMoney(row.reservedCash),
    buyPayable: parseMoney(row.buyPayable),
    blockedCash: parseMoney(row.blockedCash),
    pendingReceivable: parseMoney(row.pendingReceivable),
  };
}

function toPosition(row: PositionRow): Position {
  return {
    accountId: row.accountId,
    securityId: row.securityId,
    symbol: row.symbol,
    marketCode: row.marketCode,
    settledQuantity: parseQuantity(row.settledQuantity),
    pendingBuyQuantity: parseQuantity(row.pendingBuyQuantity),
    pendingSellQuantity: parseQuantity(row.pendingSellQuantity),
    reservedQuantity: parseQuantity(row.reservedQuantity),
    blockedQuantity: parseQuantity(row.blockedQuantity),
  };
}

function parseMoney(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new AccountRepositoryDataError("Số dư tiền không hợp lệ.");
  }

  return BigInt(value);
}

function parseQuantity(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > 4_294_967_295
  ) {
    throw new AccountRepositoryDataError("Số lượng chứng khoán không hợp lệ.");
  }

  return parsed;
}

export class AccountRepositoryDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AccountRepositoryDataError";
  }
}
