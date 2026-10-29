import { randomUUID } from "node:crypto";
import { ApplicationError } from "../../errors/application-error.js";
import type { Clock } from "../../shared/clock/clock.js";
import { applyOrderEvent } from "./oms.reducer.js";
import type { Order, OrderEvent, OrderInput, OmsRepository, RecordedEvent } from "./oms.types.js";

export class OmsService {
  public constructor(private readonly repository: OmsRepository, private readonly clock: Clock) {}

  public async create(input: OrderInput): Promise<Order> {
    const id = randomUUID();
    const event: OrderEvent = { type: "OrderReceived", payload: input };
    const order = applyOrderEvent(null, event, id);
    await this.repository.create(order, this.record(event, null, order));
    return order;
  }

  public async get(id: string): Promise<Order> {
    return (await this.repository.find(id)) ?? this.notFound();
  }

  public async events(id: string): Promise<RecordedEvent[]> {
    return (await this.repository.events(id)) ?? this.notFound();
  }

  public async apply(id: string, event: Exclude<OrderEvent, { type: "OrderReceived" }>): Promise<Order> {
    const result = await this.repository.apply(id, (previous) => {
      const order = applyOrderEvent(previous, event, id);
      return { order, event: this.record(event, previous, order) };
    }, event);
    return result ?? this.notFound();
  }

  private record(event: OrderEvent, previous: Order | null, order: Order): RecordedEvent {
    return { id: randomUUID(), orderId: order.id, eventSequence: order.version,
      fromStatus: previous?.status ?? null, toStatus: order.status,
      occurredAt: this.clock.now().toISOString(), event };
  }

  private notFound(): never {
    throw new ApplicationError(404, "ORDER_NOT_FOUND", "Không tìm thấy lệnh.");
  }
}
