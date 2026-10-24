import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSecurityMaster1792800001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO securities (
          id, symbol, display_name, security_type, market_code, currency, trading_status
      ) VALUES
      ('sec-001', 'SIMAAA', 'Cổ phiếu Công ty Alpha mô phỏng', 'STOCK', 'SIM_EQ_A', 'VND', 'TRADABLE'),
      ('sec-002', 'SIMBBB', 'Cổ phiếu Công ty Beta mô phỏng', 'STOCK', 'SIM_EQ_A', 'VND', 'SUSPENDED'),
      ('sec-003', 'SIMETF', 'Chứng chỉ quỹ ETF mô phỏng', 'ETF', 'SIM_FUND', 'VND', 'TRADABLE'),
      ('sec-004', 'SIMBOND01', 'Trái phiếu cố định Alpha 2026–2029 mô phỏng', 'BOND', 'SIM_BOND', 'VND', 'TRADABLE'),
      ('sec-005', 'SIMAAA', 'Cổ phiếu Gamma trên thị trường B mô phỏng', 'STOCK', 'SIM_EQ_B', 'VND', 'TRADABLE')
    `);

    await queryRunner.query(`
      INSERT INTO bond_terms (
          security_id, face_value, coupon_rate_bps, issue_date, maturity_date
      ) VALUES ('sec-004', 1000000.00, 800, '2026-01-15', '2029-01-15')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM bond_terms WHERE security_id = ?", [
      "sec-004",
    ]);
    await queryRunner.query(
      "DELETE FROM securities WHERE id IN (?, ?, ?, ?, ?)",
      ["sec-001", "sec-002", "sec-003", "sec-004", "sec-005"],
    );
  }
}
