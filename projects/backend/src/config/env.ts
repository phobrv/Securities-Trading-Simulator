import "dotenv/config";

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT và DB_PORT phải là số nguyên trong khoảng 1–65535.");
  }

  return parsed;
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("DB_CONNECT_TIMEOUT_MS phải là số nguyên dương.");
  }

  return parsed;
}

function readTradingDate(value: string | undefined): string {
  const tradingDate = value ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDate)) {
    throw new Error("MARKET_DATA_TRADING_DATE phải có định dạng YYYY-MM-DD.");
  }

  return tradingDate;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPort(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: readPort(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME ?? "securities_simulator",
    user: process.env.DB_USER ?? "simulator",
    password: process.env.DB_PASSWORD ?? "simulator_local_password",
    connectTimeoutMs: readPositiveInteger(
      process.env.DB_CONNECT_TIMEOUT_MS,
      3000,
    ),
  },
  marketData: {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    tradingDate: readTradingDate(process.env.MARKET_DATA_TRADING_DATE),
    tickIntervalMs: readPositiveInteger(
      process.env.MARKET_DATA_TICK_INTERVAL_MS,
      2000,
    ),
  },
};
