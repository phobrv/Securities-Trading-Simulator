import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { SecurityService } from "../../src/modules/security-master/security.service.js";
import { SystemService } from "../../src/modules/system/system.service.js";
import type {
  SecurityDetails,
  SecurityRepository,
} from "../../src/modules/security-master/security.types.js";

const securities: SecurityDetails[] = [
  {
    id: "sec-001",
    symbol: "SIMAAA",
    displayName: "Cổ phiếu Công ty Alpha mô phỏng",
    securityType: "STOCK",
    marketCode: "SIM_EQ_A",
    currency: "VND",
    tradingStatus: "TRADABLE",
    bondTerms: null,
  },
  {
    id: "sec-002",
    symbol: "SIMBBB",
    displayName: "Cổ phiếu Công ty Beta mô phỏng",
    securityType: "STOCK",
    marketCode: "SIM_EQ_A",
    currency: "VND",
    tradingStatus: "SUSPENDED",
    bondTerms: null,
  },
  {
    id: "sec-003",
    symbol: "SIMETF",
    displayName: "Chứng chỉ quỹ ETF mô phỏng",
    securityType: "ETF",
    marketCode: "SIM_FUND",
    currency: "VND",
    tradingStatus: "TRADABLE",
    bondTerms: null,
  },
  {
    id: "sec-004",
    symbol: "SIMBOND01",
    displayName: "Trái phiếu cố định Alpha 2026–2029 mô phỏng",
    securityType: "BOND",
    marketCode: "SIM_BOND",
    currency: "VND",
    tradingStatus: "TRADABLE",
    bondTerms: {
      faceValue: "1000000.00",
      couponRateBps: 800,
      issueDate: "2026-01-15",
      maturityDate: "2029-01-15",
    },
  },
];

function createTestApp(repository: SecurityRepository) {
  return createApp({
    systemService: new SystemService({ ping: async () => undefined }),
    securityService: new SecurityService(repository),
  });
}

function createRepository(): SecurityRepository & {
  findAll: jest.MockedFunction<SecurityRepository["findAll"]>;
} {
  return {
    findAll: jest.fn(async (filters) =>
      securities
        .filter((security) => {
          return (
            (!filters.type || security.securityType === filters.type) &&
            (!filters.status || security.tradingStatus === filters.status) &&
            (!filters.marketCode ||
              security.marketCode === filters.marketCode) &&
            (!filters.symbol || security.symbol === filters.symbol)
          );
        })
        .map(({ bondTerms: _bondTerms, ...security }) => security),
    ),
    findById: async (securityId) =>
      securities.find((security) => security.id === securityId) ?? null,
  };
}

describe("security master routes", () => {
  it("lists securities with normalized symbol and combined filters", async () => {
    const repository = createRepository();
    const response = await request(createTestApp(repository)).get(
      "/api/securities?type=STOCK&marketCode=sim_eq_a&symbol=%20simaaa%20",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [expect.objectContaining({ id: "sec-001" })],
      meta: { count: 1, simulation: true },
    });
    expect(repository.findAll).toHaveBeenCalledWith({
      type: "STOCK",
      status: undefined,
      marketCode: "SIM_EQ_A",
      symbol: "SIMAAA",
    });
  });

  it("returns an empty list when valid filters have no match", async () => {
    const response = await request(createTestApp(createRepository())).get(
      "/api/securities?status=DELISTED",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: { count: 0, simulation: true },
    });
  });

  it("rejects an unsupported security type", async () => {
    const response = await request(createTestApp(createRepository())).get(
      "/api/securities?type=CRYPTO",
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_SECURITY_FILTER",
        message: "Bộ lọc type không hợp lệ.",
      },
    });
  });

  it("returns bond terms for a bond", async () => {
    const response = await request(createTestApp(createRepository())).get(
      "/api/securities/sec-004",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "sec-004",
      bondTerms: {
        faceValue: "1000000.00",
        couponRateBps: 800,
        issueDate: "2026-01-15",
        maturityDate: "2029-01-15",
      },
    });
  });

  it("still returns a suspended security", async () => {
    const response = await request(createTestApp(createRepository())).get(
      "/api/securities/sec-002",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "sec-002",
      tradingStatus: "SUSPENDED",
      bondTerms: null,
    });
  });

  it("returns the documented error for an unknown security", async () => {
    const response = await request(createTestApp(createRepository())).get(
      "/api/securities/sec-not-found",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "SECURITY_NOT_FOUND",
        message: "Không tìm thấy chứng khoán.",
      },
    });
  });
});
