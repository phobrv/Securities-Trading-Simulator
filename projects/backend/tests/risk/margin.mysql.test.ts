import { afterAll, describe, expect, test } from "@jest/globals";
import express from "express";
import request from "supertest";
import type { RowDataPacket } from "mysql2/promise";
import { createDatabase } from "../../src/infrastructure/database.js";
import { MySqlMarginPolicyRepository } from "../../src/modules/risk/margin-policy.repository.js";
import { RiskCheckService } from "../../src/modules/risk/risk-check.service.js";
import { createRiskRouter } from "../../src/modules/risk/risk.routes.js";

const mysqlDescribe =
  process.env.MARGIN_MYSQL_TEST === "true" ? describe : describe.skip;
mysqlDescribe("margin MySQL read-only integration", () => {
  const database = createDatabase();
  const app = express()
    .use(express.json())
    .use(
      createRiskRouter(
        new RiskCheckService(new MySqlMarginPolicyRepository(database)),
      ),
    );
  afterAll(async () => database.close());
  test("seeded A/B/debt and repeated simulations leave financial tables unchanged", async () => {
    const snapshot = async () => {
      const tables = [
        "cash_balances",
        "cash_ledger_entries",
        "positions",
        "security_reservations",
        "cash_reservations",
        "orders",
        "loan_balances",
      ];
      const values: unknown[] = [];
      for (const table of tables)
        values.push(
          await database.query<RowDataPacket[]>(`SELECT * FROM \`${table}\``),
        );
      return values;
    };
    const before = await snapshot();
    const order = {
      securityId: "sec-001",
      side: "BUY",
      price: 25000,
      quantity: 200,
    };
    for (const [scenarioId, decision, headroom] of [
      ["scenario-A", "ALLOW", "12000000"],
      ["scenario-B", "BLOCK", "0"],
      ["scenario-A-debt", "ALLOW", "6900000"],
      ["scenario-A", "ALLOW", "12000000"],
    ]) {
      const response = await request(app)
        .post("/api/risk/margin-simulations")
        .send({ scenarioId, order })
        .expect(200);
      expect(response.body.data).toMatchObject({
        decision,
        additionalLoanHeadroom: headroom,
      });
    }
    expect(await snapshot()).toEqual(before);
  });
});
