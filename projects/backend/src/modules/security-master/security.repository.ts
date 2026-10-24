import type { RowDataPacket } from "mysql2/promise";
import type { ExecuteValues } from "mysql2";

import type { Database } from "../../infrastructure/database.js";

import type {
  Security,
  SecurityDetails,
  SecurityFilters,
  SecurityRepository,
  SecurityType,
  TradingStatus,
} from "./security.types.js";

type SecurityRow = RowDataPacket & Security;

type SecurityDetailsRow = SecurityRow & {
  faceValue: string | null;
  couponRateBps: number | null;
  issueDate: string | null;
  maturityDate: string | null;
};

export class MySqlSecurityRepository implements SecurityRepository {
  public constructor(private readonly database: Database) {}

  public async findAll(filters: SecurityFilters): Promise<Security[]> {
    const { whereClause, parameters } = buildSecurityFilterQuery(filters);
    const rows = await this.database.query<SecurityRow[]>(
      `SELECT
        id,
        symbol,
        display_name AS displayName,
        security_type AS securityType,
        market_code AS marketCode,
        currency,
        trading_status AS tradingStatus
      FROM securities${whereClause}
      ORDER BY id`,
      parameters,
    );

    return rows.map(toSecurity);
  }

  public async findById(securityId: string): Promise<SecurityDetails | null> {
    const rows = await this.database.query<SecurityDetailsRow[]>(
      `SELECT
        s.id,
        s.symbol,
        s.display_name AS displayName,
        s.security_type AS securityType,
        s.market_code AS marketCode,
        s.currency,
        s.trading_status AS tradingStatus,
        bt.face_value AS faceValue,
        bt.coupon_rate_bps AS couponRateBps,
        DATE_FORMAT(bt.issue_date, '%Y-%m-%d') AS issueDate,
        DATE_FORMAT(bt.maturity_date, '%Y-%m-%d') AS maturityDate
      FROM securities AS s
      LEFT JOIN bond_terms AS bt ON bt.security_id = s.id
      WHERE s.id = ?`,
      [securityId],
    );
    const row = rows[0];

    return row ? toSecurityDetails(row) : null;
  }
}

function buildSecurityFilterQuery(filters: SecurityFilters): {
  whereClause: string;
  parameters: ExecuteValues;
} {
  const conditions: string[] = [];
  const parameters: ExecuteValues[] = [];

  if (filters.type) {
    conditions.push("security_type = ?");
    parameters.push(filters.type);
  }
  if (filters.status) {
    conditions.push("trading_status = ?");
    parameters.push(filters.status);
  }
  if (filters.marketCode) {
    conditions.push("market_code = ?");
    parameters.push(filters.marketCode);
  }
  if (filters.symbol) {
    conditions.push("symbol = ?");
    parameters.push(filters.symbol);
  }

  return {
    whereClause:
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    parameters,
  };
}

function toSecurity(row: SecurityRow): Security {
  return {
    id: row.id,
    symbol: row.symbol,
    displayName: row.displayName,
    securityType: row.securityType as SecurityType,
    marketCode: row.marketCode,
    currency: row.currency,
    tradingStatus: row.tradingStatus as TradingStatus,
  };
}

function toSecurityDetails(row: SecurityDetailsRow): SecurityDetails {
  const security = toSecurity(row);

  if (
    security.securityType !== "BOND" ||
    row.faceValue === null ||
    row.couponRateBps === null ||
    row.issueDate === null ||
    row.maturityDate === null
  ) {
    return { ...security, bondTerms: null };
  }

  return {
    ...security,
    bondTerms: {
      faceValue: row.faceValue,
      couponRateBps: row.couponRateBps,
      issueDate: row.issueDate,
      maturityDate: row.maturityDate,
    },
  };
}
