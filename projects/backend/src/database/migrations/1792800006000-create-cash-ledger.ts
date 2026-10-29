import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCashLedger1792800006000 implements MigrationInterface {
  public transaction = false;
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE cash_reservations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL,
      order_id VARCHAR(36) NOT NULL,
      initial_amount DECIMAL(20,0) NOT NULL,
      remaining_amount DECIMAL(20,0) NOT NULL,
      consumed_amount DECIMAL(20,0) NOT NULL DEFAULT 0,
      released_amount DECIMAL(20,0) NOT NULL DEFAULT 0,
      status ENUM('ACTIVE','CLOSED') NOT NULL,
      UNIQUE KEY uq_cash_reservation_order (order_id),
      INDEX idx_cash_reservation_account (account_id, status),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      CONSTRAINT chk_cash_reservation_amounts CHECK (
        initial_amount > 0 AND remaining_amount >= 0 AND consumed_amount >= 0 AND released_amount >= 0
        AND initial_amount = remaining_amount + consumed_amount + released_amount),
      CONSTRAINT chk_cash_reservation_status CHECK (
        (status = 'ACTIVE' AND remaining_amount > 0) OR (status = 'CLOSED' AND remaining_amount = 0))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await queryRunner.query(`CREATE TABLE cash_ledger_entries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL,
      order_id VARCHAR(36) NULL,
      entry_type ENUM('OPENING','RESERVE','EXECUTION','RELEASE') NOT NULL,
      business_key VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      delta_settled_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
      delta_reserved_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
      delta_buy_payable DECIMAL(20,0) NOT NULL DEFAULT 0,
      delta_blocked_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
      delta_pending_receivable DECIMAL(20,0) NOT NULL DEFAULT 0,
      payload JSON NOT NULL,
      occurred_at TIMESTAMP(3) NOT NULL,
      UNIQUE KEY uq_cash_ledger_business (account_id, business_key),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  public async down(): Promise<void> {
    throw new Error("Cash ledger migration cannot be reverted automatically: preserve financial history.");
  }
}
