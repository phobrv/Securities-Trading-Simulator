import type { RowDataPacket } from "mysql2/promise";
import type { Database } from "../../infrastructure/database.js";
import type {
  MarginPosition,
  MarginRepository,
  MarginScenario,
} from "./margin.types.js";

type ScenarioRow = RowDataPacket & {
  policyId: string;
  policyCode: string;
  policyVersion: number;
  status: string;
  roundingPolicy: string;
  availableCash: string;
  accountCreditLimit: string;
  loanPrincipal: string;
  accruedInterest: string;
  reservedLoanAmount: string;
  positions: string | MarginPosition[];
};
type PolicyRow = RowDataPacket & {
  securityId: string;
  collateralEligible: number;
  collateralPriceCap: string | null;
  collateralRateBps: number;
  purchaseFinancingEligible: number;
  purchaseFinancingRateBps: number;
};

export class MySqlMarginPolicyRepository implements MarginRepository {
  public constructor(private readonly database: Database) {}
  public async findScenario(id: string): Promise<MarginScenario | null> {
    const rows = await this.database.query<ScenarioRow[]>(
      `SELECT p.id AS policyId, p.code AS policyCode, p.version AS policyVersion,
      p.status, p.rounding_policy AS roundingPolicy, s.available_cash AS availableCash, s.account_credit_limit AS accountCreditLimit,
      s.positions, l.loan_principal AS loanPrincipal, l.accrued_interest AS accruedInterest, l.reserved_loan_amount AS reservedLoanAmount
      FROM margin_scenarios s JOIN margin_policies p ON p.id = s.policy_id JOIN loan_balances l ON l.scenario_id = s.id WHERE s.id = ?`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const policies =
      row.status === "ACTIVE" && row.roundingPolicy === "FLOOR_PER_SECURITY"
        ? await this.database.query<PolicyRow[]>(
            `SELECT security_id AS securityId, collateral_eligible AS collateralEligible, collateral_price_cap AS collateralPriceCap,
      collateral_rate_bps AS collateralRateBps, purchase_financing_eligible AS purchaseFinancingEligible,
      purchase_financing_rate_bps AS purchaseFinancingRateBps FROM collateral_eligibility WHERE policy_id = ?`,
            [row.policyId],
          )
        : [];
    return {
      policyCode: row.policyCode,
      policyVersion: row.policyVersion,
      availableCash: BigInt(row.availableCash),
      accountCreditLimit: BigInt(row.accountCreditLimit),
      loanPrincipal: BigInt(row.loanPrincipal),
      accruedInterest: BigInt(row.accruedInterest),
      reservedLoanAmount: BigInt(row.reservedLoanAmount),
      positions:
        typeof row.positions === "string"
          ? (JSON.parse(row.positions) as MarginPosition[])
          : row.positions,
      policies: policies.map((p) => ({
        securityId: p.securityId,
        collateralEligible: Boolean(p.collateralEligible),
        collateralPriceCap:
          p.collateralPriceCap === null ? null : BigInt(p.collateralPriceCap),
        collateralRateBps: p.collateralRateBps,
        purchaseFinancingEligible: Boolean(p.purchaseFinancingEligible),
        purchaseFinancingRateBps: p.purchaseFinancingRateBps,
      })),
    };
  }
}
