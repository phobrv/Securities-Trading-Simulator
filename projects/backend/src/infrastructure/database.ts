import mysql, {
  type Pool,
  type PoolOptions,
  type RowDataPacket,
} from "mysql2/promise";
import type { ExecuteValues } from "mysql2";

import { env } from "../config/env.js";

export interface DatabaseHealthChecker {
  ping(): Promise<void>;
}

export interface Database extends DatabaseHealthChecker {
  query<TRow extends RowDataPacket[]>(
    sql: string,
    parameters?: ExecuteValues,
  ): Promise<TRow>;
  close(): Promise<void>;
}

export function createDatabase(): Database {
  const options: PoolOptions = {
    host: env.database.host,
    port: env.database.port,
    database: env.database.name,
    user: env.database.user,
    password: env.database.password,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    connectTimeout: env.database.connectTimeoutMs,
  };

  const pool: Pool = mysql.createPool(options);

  return {
    async ping(): Promise<void> {
      await pool.query("SELECT 1");
    },
    async query<TRow extends RowDataPacket[]>(
      sql: string,
      parameters: ExecuteValues = [],
    ): Promise<TRow> {
      const [rows] = await pool.execute<TRow>(sql, parameters);

      return rows;
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
