export type AvailableCashInput = {
  settledCash: bigint;
  reservedCash: bigint;
  buyPayable: bigint;
  blockedCash: bigint;
};

export type AvailableQuantityInput = {
  settledQuantity: number;
  pendingSellQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
};

export function calculateAvailableCash(input: AvailableCashInput): bigint {
  const availableCash =
    input.settledCash -
    input.reservedCash -
    input.buyPayable -
    input.blockedCash;

  if (availableCash < 0n) {
    throw new AvailabilityCalculationError("Tiền khả dụng không thể âm.");
  }

  return availableCash;
}

export function calculateAvailableQuantity(
  input: AvailableQuantityInput,
): number {
  const availableQuantity =
    input.settledQuantity -
    input.pendingSellQuantity -
    input.reservedQuantity -
    input.blockedQuantity;

  if (availableQuantity < 0) {
    throw new AvailabilityCalculationError(
      "Số lượng chứng khoán khả dụng không thể âm.",
    );
  }

  return availableQuantity;
}

export class AvailabilityCalculationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AvailabilityCalculationError";
  }
}
