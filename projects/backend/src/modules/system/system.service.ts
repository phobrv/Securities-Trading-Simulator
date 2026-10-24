import type { DatabaseHealthChecker } from "../../infrastructure/database.js";

import type { SystemOverview } from "./system.types.js";

export class SystemService {
  public constructor(private readonly database: DatabaseHealthChecker) {}

  public async isReady(): Promise<boolean> {
    try {
      await this.database.ping();
      return true;
    } catch {
      console.error("Database readiness check failed.");
      return false;
    }
  }

  public getOverview(): SystemOverview {
    return {
      name: "Securities Trading Simulator",
      mode: "SIMULATION",
      conventions: {
        currency: "VND",
        priceUnit: "VND_PER_UNIT",
        timestampFormat: "ISO_8601",
        displayTimeZone: "Asia/Ho_Chi_Minh",
      },
      modules: [
        { name: "System", status: "IMPLEMENTED" },
        { name: "SecurityMaster", status: "IMPLEMENTED" },
        { name: "MarketData", status: "IMPLEMENTED" },
        { name: "OMS", status: "PLANNED" },
      ],
    };
  }
}
