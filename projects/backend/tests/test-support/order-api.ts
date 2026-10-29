import { createApp, type AppDependencies } from "../../src/app.js";
import type { Database } from "../../src/infrastructure/database.js";
import { marketSessionConfigs } from "../../src/modules/market-session/market-session.config.js";
import { MarketSessionService } from "../../src/modules/market-session/market-session.service.js";
import { OrderApiRepository } from "../../src/modules/oms/order-api.repository.js";
import { OrderApiService } from "../../src/modules/oms/order-api.service.js";
import { FixedClock } from "../../src/shared/clock/fixed-clock.js";

export const orderInput = { accountId: "acc-001", securityId: "sec-001", side: "BUY", orderType: "LO", price: 25000, quantity: 100 } as const;

export function orderApiService(database: Database, requester: string, instant = "2026-10-20T03:00:00Z"): OrderApiService {
  const clock = new FixedClock(new Date(instant));
  return new OrderApiService(new OrderApiRepository(database, clock), new MarketSessionService(marketSessionConfigs, clock, "FIXED"), clock, requester);
}

export function orderApiApp(service: OrderApiService) {
  return createApp({ systemService: {}, securityService: {}, marketDataService: {}, marketSessionService: {},
    orderSessionValidator: {}, orderApiService: service } as unknown as AppDependencies);
}

export async function deleteTestOrder(database: Database, id: string): Promise<void> {
  await database.transaction(async (connection) => {
    await connection.execute("DELETE FROM idempotency_requests WHERE order_id = ?", [id]);
    await connection.execute("DELETE FROM order_events WHERE order_id = ?", [id]);
    await connection.execute("DELETE FROM orders WHERE id = ?", [id]);
  });
}
