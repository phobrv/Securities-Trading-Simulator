import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMarginSimulation1792800009000 implements MigrationInterface {
  public transaction = false;
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE margin_policies (
      id VARCHAR(36) PRIMARY KEY, code VARCHAR(64) NOT NULL, version INT UNSIGNED NOT NULL,
      rounding_policy VARCHAR(32) NOT NULL, status ENUM('ACTIVE','INACTIVE') NOT NULL,
      UNIQUE KEY uq_margin_policy_version (code, version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(`CREATE TABLE collateral_eligibility (
      policy_id VARCHAR(36) NOT NULL, security_id VARCHAR(36) NOT NULL,
      collateral_eligible BOOLEAN NOT NULL, collateral_price_cap DECIMAL(20,0) NULL,
      collateral_rate_bps INT NOT NULL, purchase_financing_eligible BOOLEAN NOT NULL,
      purchase_financing_rate_bps INT NOT NULL,
      PRIMARY KEY (policy_id, security_id),
      FOREIGN KEY (policy_id) REFERENCES margin_policies(id), FOREIGN KEY (security_id) REFERENCES securities(id),
      CHECK (collateral_rate_bps BETWEEN 0 AND 10000), CHECK (purchase_financing_rate_bps >= 0 AND purchase_financing_rate_bps < 10000),
      CHECK (collateral_price_cap IS NULL OR collateral_price_cap > 0),
      CHECK (collateral_eligible = 0 OR collateral_price_cap IS NOT NULL)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(`CREATE TABLE margin_scenarios (
      id VARCHAR(36) PRIMARY KEY, policy_id VARCHAR(36) NOT NULL,
      available_cash DECIMAL(20,0) NOT NULL, account_credit_limit DECIMAL(20,0) NOT NULL,
      positions JSON NOT NULL, FOREIGN KEY (policy_id) REFERENCES margin_policies(id),
      CHECK (available_cash >= 0 AND account_credit_limit >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(`CREATE TABLE loan_balances (
      scenario_id VARCHAR(36) PRIMARY KEY, loan_principal DECIMAL(20,0) NOT NULL,
      accrued_interest DECIMAL(20,0) NOT NULL, reserved_loan_amount DECIMAL(20,0) NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES margin_scenarios(id),
      CHECK (loan_principal >= 0 AND accrued_interest >= 0 AND reserved_loan_amount >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(
      "INSERT INTO margin_policies VALUES ('policy-sim-v1', 'SIM_MARGIN_V1', 1, 'FLOOR_PER_SECURITY', 'ACTIVE')",
    );
    await q.query(
      "INSERT INTO collateral_eligibility VALUES ('policy-sim-v1','sec-001',1,24000,5000,1,5000), ('policy-sim-v1','sec-003',0,NULL,0,0,0)",
    );
    const position = (id: string) =>
      JSON.stringify([
        {
          securityId: id,
          settledQuantity: 1000,
          pendingBuyQuantity: 0,
          pendingSellQuantity: 0,
          reservedSellQuantity: 0,
          blockedQuantity: 0,
          marketPrice: "25000",
        },
      ]);
    for (const [id, security] of [
      ["scenario-A", "sec-001"],
      ["scenario-B", "sec-003"],
      ["scenario-A-debt", "sec-001"],
    ]) {
      await q.query(
        "INSERT INTO margin_scenarios VALUES (?, 'policy-sim-v1', 3000000, 20000000, ?)",
        [id, position(security)],
      );
    }
    await q.query(
      "INSERT INTO loan_balances VALUES ('scenario-A',0,0,0), ('scenario-B',0,0,0), ('scenario-A-debt',4000000,100000,1000000)",
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE loan_balances");
    await q.query("DROP TABLE margin_scenarios");
    await q.query("DROP TABLE collateral_eligibility");
    await q.query("DROP TABLE margin_policies");
  }
}
