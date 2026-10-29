import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePortfolio1792800008000 implements MigrationInterface {
  public transaction = false;
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE positions ADD COLUMN total_cost DECIMAL(20,0) NULL,
      ADD COLUMN realized_pnl DECIMAL(20,0) NULL,
      ADD CONSTRAINT chk_position_total_cost CHECK (total_cost IS NULL OR total_cost >= 0)`);
    await q.query(`CREATE TABLE position_movements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL, security_id VARCHAR(36) NOT NULL,
      order_id VARCHAR(36) NULL, execution_id VARCHAR(64) NULL,
      movement_type ENUM('OPENING','BUY','SELL') NOT NULL,
      business_key VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      delta_economic_quantity BIGINT NOT NULL, delta_total_cost DECIMAL(20,0) NOT NULL,
      delta_realized_pnl DECIMAL(20,0) NOT NULL DEFAULT 0, payload JSON NOT NULL,
      occurred_at TIMESTAMP(3) NOT NULL,
      UNIQUE KEY uq_position_movement_business (account_id, security_id, business_key),
      FOREIGN KEY (account_id, security_id) REFERENCES positions(account_id, security_id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(
      "INSERT INTO accounts (id, customer_ref, account_type, status) VALUES ('acc-004', 'customer-004', 'CASH', 'ACTIVE')",
    );
    await q.query(
      "INSERT INTO cash_balances (account_id, currency, settled_cash) VALUES ('acc-004', 'VND', 10000000)",
    );
    await q.query(`INSERT INTO cash_ledger_entries (account_id, entry_type, business_key, delta_settled_cash, payload, occurred_at)
      VALUES ('acc-004', 'OPENING', 'OPENING:acc-004:v1', 10000000, JSON_OBJECT(), UTC_TIMESTAMP(3))`);
  }
  public async down(): Promise<void> {
    throw new Error("Portfolio history cannot be reverted automatically.");
  }
}
