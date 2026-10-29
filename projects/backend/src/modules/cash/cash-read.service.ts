import type { CashReadRepository } from "./cash-read.repository.js";

export class CashReadService {
  public constructor(private readonly repository: Pick<CashReadRepository, "reservation" | "ledger">) {}

  public getReservation(orderId: string) {
    return this.repository.reservation(orderId);
  }

  public getLedger(accountId: string) {
    return this.repository.ledger(accountId);
  }
}
