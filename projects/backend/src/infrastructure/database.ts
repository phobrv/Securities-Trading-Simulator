import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

import { env } from "../config/env.js";

export interface DatabaseHealthChecker {
  ping(): Promise<void>;
}

export interface Database extends DatabaseHealthChecker {
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
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
