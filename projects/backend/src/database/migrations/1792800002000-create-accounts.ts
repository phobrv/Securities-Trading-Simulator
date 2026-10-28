import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccounts1792800002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accounts (
          id VARCHAR(36) NOT NULL,
          customer_ref VARCHAR(36) NOT NULL,
          account_type ENUM('CASH') NOT NULL DEFAULT 'CASH',
          status ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
          PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE cash_balances (
          account_id VARCHAR(36) NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'VND',
          settled_cash DECIMAL(20, 0) NOT NULL DEFAULT 0,
          reserved_cash DECIMAL(20, 0) NOT NULL DEFAULT 0,
          buy_payable DECIMAL(20, 0) NOT NULL DEFAULT 0,
          blocked_cash DECIMAL(20, 0) NOT NULL DEFAULT 0,
          pending_receivable DECIMAL(20, 0) NOT NULL DEFAULT 0,
          PRIMARY KEY (account_id),
          CONSTRAINT fk_cash_balances_account
              FOREIGN KEY (account_id) REFERENCES accounts(id),
          CONSTRAINT chk_cash_nonnegative CHECK (
              settled_cash >= 0
              AND reserved_cash >= 0
              AND buy_payable >= 0
              AND blocked_cash >= 0
              AND pending_receivable >= 0
          ),
          CONSTRAINT chk_cash_available CHECK (
              settled_cash >= reserved_cash + buy_payable + blocked_cash
          ),
          CONSTRAINT chk_cash_currency CHECK (currency = 'VND')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE positions (
          account_id VARCHAR(36) NOT NULL,
          security_id VARCHAR(36) NOT NULL,
          settled_quantity INT UNSIGNED NOT NULL DEFAULT 0,
          pending_buy_quantity INT UNSIGNED NOT NULL DEFAULT 0,
          pending_sell_quantity INT UNSIGNED NOT NULL DEFAULT 0,
          blocked_quantity INT UNSIGNED NOT NULL DEFAULT 0,
          PRIMARY KEY (account_id, security_id),
          CONSTRAINT fk_positions_account
              FOREIGN KEY (account_id) REFERENCES accounts(id),
          CONSTRAINT fk_positions_security
              FOREIGN KEY (security_id) REFERENCES securities(id),
          CONSTRAINT chk_position_base CHECK (
              settled_quantity >= pending_sell_quantity + blocked_quantity
          )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE security_reservations (
          id VARCHAR(36) NOT NULL,
          account_id VARCHAR(36) NOT NULL,
          security_id VARCHAR(36) NOT NULL,
          order_reference VARCHAR(64) NOT NULL,
          quantity INT UNSIGNED NOT NULL,
          status ENUM('ACTIVE', 'RELEASED') NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_security_reservation_order (account_id, order_reference),
          CONSTRAINT fk_security_reservations_position
              FOREIGN KEY (account_id, security_id)
              REFERENCES positions(account_id, security_id),
          CONSTRAINT chk_security_reservation_quantity CHECK (quantity > 0),
          INDEX idx_security_reservations_lookup (account_id, security_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE security_reservations");
    await queryRunner.query("DROP TABLE positions");
    await queryRunner.query("DROP TABLE cash_balances");
    await queryRunner.query("DROP TABLE accounts");
  }
}
