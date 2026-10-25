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

function readSimClock(): {
  mode: "SYSTEM" | "FIXED";
  fixedInstant: Date | null;
} {
  const mode = process.env.SIM_CLOCK_MODE ?? "SYSTEM";
  if (mode !== "SYSTEM" && mode !== "FIXED") {
    throw new Error("SIM_CLOCK_MODE phải là SYSTEM hoặc FIXED.");
  }
  if (mode === "SYSTEM") {
    return { mode, fixedInstant: null };
  }

  const value = process.env.SIM_NOW;
  const instant = value ? parseIsoInstant(value) : null;
  if (!instant || Number.isNaN(instant.getTime())) {
    throw new Error(
      "SIM_NOW phải là một ISO 8601 instant hợp lệ, ví dụ 2026-10-20T09:10:00+07:00.",
    );
  }

  return { mode, fixedInstant: instant };
}

function parseIsoInstant(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute =
    offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const hasValidDate =
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;
  if (
    !hasValidDate ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
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
  simClock: readSimClock(),
};
