import { describe, expect, it } from "@jest/globals";

import {
  SecurityNotFoundError,
  SecurityNotTradableError,
  SecurityService,
} from "../../src/modules/security-master/security.service.js";
import type {
  SecurityDetails,
  SecurityRepository,
} from "../../src/modules/security-master/security.types.js";

const tradableSecurity: SecurityDetails = {
  id: "sec-001",
  symbol: "SIMAAA",
  displayName: "Cổ phiếu Công ty Alpha mô phỏng",
  securityType: "STOCK",
  marketCode: "SIM_EQ_A",
  currency: "VND",
  tradingStatus: "TRADABLE",
  bondTerms: null,
};

function createRepository(
  security: SecurityDetails | null,
): SecurityRepository {
  return {
    findAll: async () => [],
    findById: async () => security,
  };
}

describe("SecurityService", () => {
  it("returns a tradable security for OMS checks", async () => {
    const service = new SecurityService(createRepository(tradableSecurity));

    await expect(service.assertSecurityTradable("sec-001")).resolves.toEqual(
      tradableSecurity,
    );
  });

  it("rejects a suspended security for OMS checks", async () => {
    const service = new SecurityService(
      createRepository({ ...tradableSecurity, tradingStatus: "SUSPENDED" }),
    );

    await expect(
      service.assertSecurityTradable("sec-002"),
    ).rejects.toBeInstanceOf(SecurityNotTradableError);
  });

  it("distinguishes an unknown security", async () => {
    const service = new SecurityService(createRepository(null));

    await expect(
      service.assertSecurityTradable("sec-missing"),
    ).rejects.toBeInstanceOf(SecurityNotFoundError);
  });
});
