import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOms1792800004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE orders (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL,
      security_id VARCHAR(36) NOT NULL,
      side ENUM('BUY','SELL') NOT NULL,
      order_type ENUM('LO') NOT NULL,
      price DECIMAL(20,0) NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      filled_quantity INT UNSIGNED NOT NULL DEFAULT 0,
      remaining_quantity INT UNSIGNED NOT NULL,
      canceled_quantity INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('PENDING_NEW','NEW','PARTIALLY_FILLED','FILLED','CANCELED','REJECTED') NOT NULL,
      cancel_request_status ENUM('NONE','PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'NONE',
      version INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (security_id) REFERENCES securities(id),
      CONSTRAINT chk_order_input CHECK (price > 0 AND quantity > 0),
      CONSTRAINT chk_order_quantities CHECK (filled_quantity + remaining_quantity + canceled_quantity <= quantity),
      INDEX idx_orders_account_created (account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await queryRunner.query(`CREATE TABLE order_events (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      order_id VARCHAR(36) NOT NULL,
      event_sequence INT UNSIGNED NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      from_status VARCHAR(32) NULL,
      to_status VARCHAR(32) NOT NULL,
      reason_code VARCHAR(64) NULL,
      payload JSON NOT NULL,
      occurred_at TIMESTAMP(3) NOT NULL,
      recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      UNIQUE KEY uq_order_event_sequence (order_id, event_sequence)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE order_events");
    await queryRunner.query("DROP TABLE orders");
  }
}
