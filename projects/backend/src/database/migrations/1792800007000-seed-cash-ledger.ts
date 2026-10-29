import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedCashLedger1792800007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("INSERT INTO accounts (id, customer_ref, account_type, status) VALUES ('acc-003', 'customer-003', 'CASH', 'ACTIVE')");
    await queryRunner.query("INSERT INTO cash_balances (account_id, currency, settled_cash) VALUES ('acc-003', 'VND', 10000000)");
    await queryRunner.query(`INSERT INTO cash_ledger_entries
      (account_id, entry_type, business_key, delta_settled_cash, payload, occurred_at)
      VALUES ('acc-003', 'OPENING', 'OPENING:acc-003:v1', 10000000, JSON_OBJECT(), UTC_TIMESTAMP(3))`);
  }

  public async down(): Promise<void> {
    throw new Error("Opening ledger cannot be reverted automatically: preserve financial history.");
  }
}
