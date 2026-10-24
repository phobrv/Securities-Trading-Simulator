import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import { MarketDataService } from "../../src/modules/market-data/market-data.service.js";

function createSecurityService(): SecurityService {
  return new SecurityService({
    findAll: async () => [],
    findById: async () => null,
  });
}

function createMarketDataService(
  securityService: SecurityService,
): MarketDataService {
  return new MarketDataService(
    securityService,
    { getQuote: async () => null, saveAndPublish: async () => undefined },
    "2026-10-24",
  );
}

describe("system overview", () => {
  it("returns simulation metadata without accessing the database", async () => {
    const database = {
      ping: jest.fn(async () => {
        throw new Error("This endpoint must not query MySQL.");
      }),
    };
    const securityService = createSecurityService();
    const app = createApp({
      systemService: new SystemService(database),
      securityService,
      marketDataService: createMarketDataService(securityService),
    });

    const response = await request(app).get("/api/system/overview");

    expect(response.status).toBe(200);
    expect(database.ping).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      name: "Securities Trading Simulator",
      mode: "SIMULATION",
      conventions: {
        currency: "VND",
        priceUnit: "VND_PER_UNIT",
        timestampFormat: "ISO_8601",
        displayTimeZone: "Asia/Ho_Chi_Minh",
      },
    });
  });

  it("allows a frontend running on another local development port", async () => {
    const securityService = createSecurityService();
    const app = createApp({
      systemService: new SystemService({ ping: async () => undefined }),
      securityService,
      marketDataService: createMarketDataService(securityService),
    });

    const response = await request(app)
      .get("/api/system/overview")
      .set("Origin", "http://localhost:5174");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5174",
    );
  });
});
