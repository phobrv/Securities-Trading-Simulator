import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import { ApplicationError } from "../../src/errors/application-error.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { createCashReadRouter } from "../../src/modules/cash/cash-read.routes.js";
import { CashReadService } from "../../src/modules/cash/cash-read.service.js";
import type { CashReadRepository } from "../../src/modules/cash/cash-read.repository.js";

describe("cash read API", () => {
  const repository = {
    async reservation(id: string) {
      if (id !== "order") throw new ApplicationError(404, "CASH_RESERVATION_NOT_FOUND", "Not found");
      return { orderId: id, remainingAmount: "1500000" };
    },
    async ledger(id: string) { return [{ accountId: id, deltaReservedCash: "2500000" }]; },
  } as unknown as CashReadRepository;
  const app = express().use(createCashReadRouter(new CashReadService(repository))).use(errorHandler);

  it("returns money as strings and maps missing reservation errors", async () => {
    expect((await request(app).get("/api/orders/order/cash-reservation")).body.data.remainingAmount).toBe("1500000");
    expect((await request(app).get("/api/accounts/account/cash-ledger")).body.data[0].deltaReservedCash).toBe("2500000");
    const missing = await request(app).get("/api/orders/missing/cash-reservation");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("CASH_RESERVATION_NOT_FOUND");
  });
});
