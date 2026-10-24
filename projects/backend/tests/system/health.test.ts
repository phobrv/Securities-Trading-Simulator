import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import type { DatabaseHealthChecker } from "../../src/infrastructure/database.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";

function createTestApp(database: DatabaseHealthChecker) {
  return createApp({
    systemService: new SystemService(database),
    securityService: new SecurityService({
      findAll: async () => [],
      findById: async () => null,
    }),
  });
}

describe("health endpoints", () => {
  it("returns 200 when the HTTP process is live", async () => {
    const app = createTestApp({ ping: async () => undefined });

    const response = await request(app).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "LIVE" });
  });

  it("returns 200 when MySQL accepts SELECT 1", async () => {
    const app = createTestApp({ ping: async () => undefined });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "READY",
      checks: { database: "UP" },
    });
  });

  it("returns 503 without leaking database details when MySQL is unavailable", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const app = createTestApp({
      ping: async () => {
        throw new Error("Connection refused");
      },
    });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "NOT_READY",
      checks: { database: "DOWN" },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Database readiness check failed.",
    );
    consoleError.mockRestore();
  });
});
