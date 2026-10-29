import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdempotency1792800005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE idempotency_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      scope_hash BINARY(32) NOT NULL,
      idempotency_key VARBINARY(128) NOT NULL,
      request_hash BINARY(32) NOT NULL,
      order_id VARCHAR(36) NULL,
      http_status SMALLINT UNSIGNED NULL,
      response_body JSON NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_idempotency_scope_key (scope_hash, idempotency_key),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE idempotency_requests");
  }
}
