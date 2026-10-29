import { createHash } from "node:crypto";
import { ApplicationError } from "../../errors/application-error.js";
import type { Clock } from "../../shared/clock/clock.js";
import type { MarketSessionService } from "../market-session/market-session.service.js";
import { precheckOrder } from "./order-api.precheck.js";
import { OrderApiRepository } from "./order-api.repository.js";
import { createReservation, requireFunds } from "../cash/cash.repository.js";
import type { OrderInput } from "./oms.types.js";

function hash(value: unknown): Buffer { return createHash("sha256").update(JSON.stringify(value)).digest(); }

export class OrderApiService {
  public constructor(private readonly repository: OrderApiRepository, private readonly sessions: MarketSessionService,
    private readonly clock: Clock, private readonly requester: string) {}

  public create(input: OrderInput, key: string) {
    const canonical = { accountId: input.accountId, securityId: input.securityId, side: input.side,
      orderType: input.orderType, price: BigInt(input.price).toString(), quantity: input.quantity };
    return this.repository.execute({ scope: hash([this.requester, input.accountId, "CREATE_ORDER"]),
      key: Buffer.from(key), hash: hash(canonical) }, async (connection) => {
      if (input.side !== "BUY") throw new ApplicationError(422, "ORDER_SIDE_UNSUPPORTED", "Luồng mới chỉ hỗ trợ lệnh mua.");
      const amount = await requireFunds(connection, input.accountId, input.price, input.quantity);
      await precheckOrder(connection, input, this.sessions, this.clock);
      const order = await this.repository.create(connection, input);
      await createReservation(connection, order, amount, this.clock.now().toISOString());
      return order;
    });
  }

  public async cancel(id: string, key: string) {
    const order = await this.get(id);
    return this.repository.execute({ scope: hash([this.requester, order.accountId, "CANCEL_ORDER", id]),
      key: Buffer.from(key), hash: hash({}) }, (connection) => this.repository.cancel(connection, id));
  }

  public async get(id: string) {
    const order = await this.repository.find(id);
    if (!order) throw new ApplicationError(404, "ORDER_NOT_FOUND", "Không tìm thấy lệnh.");
    return order;
  }
}
