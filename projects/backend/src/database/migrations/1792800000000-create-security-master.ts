import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSecurityMaster1792800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE securities (
          id VARCHAR(36) NOT NULL,
          symbol VARCHAR(32) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          security_type ENUM('STOCK', 'BOND', 'ETF') NOT NULL,
          market_code VARCHAR(32) NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'VND',
          trading_status ENUM('TRADABLE', 'SUSPENDED', 'DELISTED') NOT NULL,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          CONSTRAINT uq_securities_market_symbol UNIQUE (market_code, symbol),
          INDEX idx_securities_type_status (security_type, trading_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE bond_terms (
          security_id VARCHAR(36) NOT NULL,
          face_value DECIMAL(20, 2) NOT NULL,
          coupon_rate_bps INT UNSIGNED NOT NULL,
          issue_date DATE NOT NULL,
          maturity_date DATE NOT NULL,
          PRIMARY KEY (security_id),
          CONSTRAINT fk_bond_terms_security
              FOREIGN KEY (security_id) REFERENCES securities(id),
          CONSTRAINT chk_bond_face_value CHECK (face_value > 0),
          CONSTRAINT chk_bond_dates CHECK (maturity_date > issue_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE bond_terms");
    await queryRunner.query("DROP TABLE securities");
  }
}
