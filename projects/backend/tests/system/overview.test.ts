import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { SystemService } from "../../src/modules/system/system.service.js";

describe("system overview", () => {
  it("returns simulation metadata without accessing the database", async () => {
    const database = {
      ping: jest.fn(async () => {
        throw new Error("This endpoint must not query MySQL.");
      }),
    };
    const app = createApp({ systemService: new SystemService(database) });

    const response = await request(app).get("/api/system/overview");

    expect(response.status).toBe(200);
    expect(database.ping).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      name: "Securities Trading Simulator",
      mode: "SIMULATION",
      conventions: {
        currency: "VND",
        priceUnit: "VND_PER_SHARE",
        timestampFormat: "ISO_8601",
        displayTimeZone: "Asia/Ho_Chi_Minh",
      },
    });
  });
});
