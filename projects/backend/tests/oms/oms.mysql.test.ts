import { describe, expect, it } from "@jest/globals";
import { createDatabase } from "../../src/infrastructure/database.js";
import { MySqlOmsRepository } from "../../src/modules/oms/oms.repository.js";
import { applyOrderEvent } from "../../src/modules/oms/oms.reducer.js";
import { OmsService } from "../../src/modules/oms/oms.service.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";

// Explicit opt-in: requires migrated disposable test database with the standard fixtures.
const mysqlDescribe = process.env.OMS_MYSQL_TEST === "true" ? describe : describe.skip;
mysqlDescribe("OMS MySQL transaction", () => {
  it("rolls back update if insert event fails", async () => {
    const database = createDatabase();
    const repository = new MySqlOmsRepository(database);
    const service = new OmsService(repository, new FixedClock(new Date("2026-10-20T03:00:00Z")));
    let id: string | undefined;
    try {
      const order = await service.create({ accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: "25000", quantity: 100 });
      id = order.id;
      const first = (await repository.events(id))![0];
      await expect(repository.apply(id, (previous) => {
        const event = { type: "OrderAccepted", payload: {} } as const;
        const next = applyOrderEvent(previous, event, previous.id);
        return { order: next, event: { ...first, eventSequence: 2, fromStatus: previous.status, toStatus: next.status, event } };
      })).rejects.toThrow();
      expect(await repository.find(id)).toMatchObject({ status: "PENDING_NEW", version: 1 });
      expect(await repository.events(id)).toHaveLength(1);
    } finally {
      if (id) {
        const orderId = id;
        await database.transaction(async (connection) => {
          await connection.execute("DELETE FROM order_events WHERE order_id = ?", [orderId]);
          await connection.execute("DELETE FROM orders WHERE id = ?", [orderId]);
        });
      }
      await database.close();
    }
  });
});
