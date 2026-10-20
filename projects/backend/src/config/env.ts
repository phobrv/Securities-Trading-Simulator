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

export const env = {
  port: readPort(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
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
};
