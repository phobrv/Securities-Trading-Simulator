import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedAccounts1792800003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO accounts (id, customer_ref, account_type, status) VALUES
      ('acc-001', 'customer-001', 'CASH', 'ACTIVE'),
      ('acc-002', 'customer-002', 'CASH', 'ACTIVE')
    `);

    await queryRunner.query(`
      INSERT INTO cash_balances (
          account_id, currency, settled_cash, reserved_cash, buy_payable,
          blocked_cash, pending_receivable
      ) VALUES
      ('acc-001', 'VND', 10000000, 2500000, 1000000, 500000, 2000000),
      ('acc-002', 'VND', 1000000, 0, 0, 0, 0)
    `);

    await queryRunner.query(`
      INSERT INTO positions (
          account_id, security_id, settled_quantity, pending_buy_quantity,
          pending_sell_quantity, blocked_quantity
      ) VALUES
      ('acc-001', 'sec-001', 1000, 200, 100, 50),
      ('acc-002', 'sec-001', 100, 0, 0, 0)
    `);

    await queryRunner.query(`
      INSERT INTO security_reservations (
          id, account_id, security_id, order_reference, quantity, status
      ) VALUES
      ('res-001', 'acc-001', 'sec-001', 'fixture-sell-001', 200, 'ACTIVE'),
      ('res-002', 'acc-001', 'sec-001', 'fixture-sell-002', 100, 'ACTIVE'),
      ('res-003', 'acc-001', 'sec-001', 'fixture-sell-old', 50, 'RELEASED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM security_reservations WHERE id IN (?, ?, ?)",
      ["res-001", "res-002", "res-003"],
    );
    await queryRunner.query(
      "DELETE FROM positions WHERE account_id IN (?, ?)",
      ["acc-001", "acc-002"],
    );
    await queryRunner.query(
      "DELETE FROM cash_balances WHERE account_id IN (?, ?)",
      ["acc-001", "acc-002"],
    );
    await queryRunner.query("DELETE FROM accounts WHERE id IN (?, ?)", [
      "acc-001",
      "acc-002",
    ]);
  }
}
