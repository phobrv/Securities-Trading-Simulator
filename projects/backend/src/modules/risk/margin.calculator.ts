import type {
  MarginOrder,
  MarginScenario,
  ReasonCode,
  SecurityPolicy,
} from "./margin.types.js";

const bps = 10000n;
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const positive = (a: bigint) => (a > 0n ? a : 0n);

function validPolicy(p: SecurityPolicy): boolean {
  return (
    Number.isInteger(p.collateralRateBps) &&
    p.collateralRateBps >= 0 &&
    p.collateralRateBps <= 10000 &&
    Number.isInteger(p.purchaseFinancingRateBps) &&
    p.purchaseFinancingRateBps >= 0 &&
    p.purchaseFinancingRateBps < 10000 &&
    (!p.collateralEligible ||
      (p.collateralPriceCap !== null && p.collateralPriceCap > 0n))
  );
}

export function calculateMargin(
  scenario: MarginScenario,
  order: MarginOrder,
  evaluatedAt: string,
) {
  const reasons: ReasonCode[] = [];
  const add = (reason: ReasonCode) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const policyFor = (id: string) =>
    scenario.policies.find((p) => p.securityId === id);
  const orderPolicy = policyFor(order.securityId);
  if (!orderPolicy || !validPolicy(orderPolicy)) add("POLICY_NOT_CONFIGURED");
  const breakdown = scenario.positions.map((position) => {
    const policy = policyFor(position.securityId);
    const quantities = [
      position.settledQuantity,
      position.pendingBuyQuantity,
      position.pendingSellQuantity,
      position.reservedSellQuantity,
      position.blockedQuantity,
    ];
    const validQuantity = quantities.every(
      (q) => Number.isSafeInteger(q) && q >= 0,
    );
    const quantity = validQuantity
      ? position.settledQuantity -
        position.pendingSellQuantity -
        position.reservedSellQuantity -
        position.blockedQuantity
      : -1;
    if (!Number.isSafeInteger(quantity) || quantity < 0)
      add("INVALID_COLLATERAL_QUANTITY");
    if (!policy || !validPolicy(policy)) add("POLICY_NOT_CONFIGURED");
    const eligible = policy?.collateralEligible ?? null;
    const priceValid =
      typeof position.marketPrice === "string" &&
      /^[1-9]\d*$/.test(position.marketPrice);
    if (eligible && !priceValid) add("MISSING_VALUATION_PRICE");
    const price = priceValid ? BigInt(position.marketPrice!) : null;
    const valuation =
      eligible && price !== null && policy?.collateralPriceCap
        ? min(price, policy.collateralPriceCap)
        : null;
    const recognized =
      eligible === false
        ? 0n
        : valuation !== null && quantity >= 0
          ? BigInt(quantity) * valuation
          : null;
    const capacity =
      recognized !== null && policy && validPolicy(policy)
        ? (recognized * BigInt(policy.collateralRateBps)) / bps
        : null;
    return {
      securityId: position.securityId,
      eligible,
      collateralQuantity: quantity >= 0 ? quantity : null,
      marketPrice: price?.toString() ?? null,
      valuationPrice: valuation?.toString() ?? null,
      recognizedAssetValue: recognized?.toString() ?? null,
      collateralRateBps: policy?.collateralRateBps ?? null,
      loanCapacity: capacity?.toString() ?? null,
    };
  });
  const unavailable = reasons.length > 0;
  const gross = unavailable
    ? null
    : breakdown.reduce((sum, item) => sum + BigInt(item.loanCapacity!), 0n);
  const effective =
    gross === null ? null : min(gross, scenario.accountCreditLimit);
  const exposure =
    scenario.loanPrincipal +
    scenario.accruedInterest +
    scenario.reservedLoanAmount;
  const headroom = effective === null ? null : positive(effective - exposure);
  const orderValue = BigInt(order.price) * BigInt(order.quantity);
  const required = positive(orderValue - scenario.availableCash);
  const financing =
    orderPolicy && validPolicy(orderPolicy)
      ? (orderValue * BigInt(orderPolicy.purchaseFinancingRateBps)) / bps
      : null;
  if (
    !unavailable &&
    effective !== null &&
    headroom !== null &&
    financing !== null &&
    orderPolicy
  ) {
    if (exposure > effective) add("EXISTING_EXPOSURE_EXCEEDS_LIMIT");
    if (required > 0n && !orderPolicy.purchaseFinancingEligible)
      add("SECURITY_NOT_FINANCEABLE");
    if (required > headroom) add("INSUFFICIENT_LOAN_HEADROOM");
    if (required > financing) add("ORDER_FINANCING_RATIO_EXCEEDED");
  }
  return {
    mode: "SIMULATION_ONLY" as const,
    policyCode: scenario.policyCode,
    policyVersion: scenario.policyVersion,
    evaluatedAt,
    pricingMode: "SCENARIO_INPUT" as const,
    currency: "VND" as const,
    availableCash: scenario.availableCash.toString(),
    grossLoanCapacity: gross?.toString() ?? null,
    accountCreditLimit: scenario.accountCreditLimit.toString(),
    effectiveLoanLimit: effective?.toString() ?? null,
    currentExposure: exposure.toString(),
    additionalLoanHeadroom: headroom?.toString() ?? null,
    orderValue: orderValue.toString(),
    requiredLoan: required.toString(),
    orderFinancingLimit: financing?.toString() ?? null,
    decision: unavailable
      ? ("UNAVAILABLE" as const)
      : reasons.length
        ? ("BLOCK" as const)
        : ("ALLOW" as const),
    reasonCodes: reasons,
    collateralBreakdown: breakdown,
  };
}
