import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ExecuteValues } from "mysql2";
import type { Database } from "../../infrastructure/database.js";
import { ApplicationError } from "../../errors/application-error.js";
import { MySqlAccountRepository } from "../accounts/account.repository.js";
import { AccountService } from "../accounts/account.service.js";
import { MySqlSecurityRepository } from "../security-master/security.repository.js";
import { SecurityService } from "../security-master/security.service.js";
import { OrderSessionValidator } from "../market-session/order-session-validator.js";
import type { MarketSessionService } from "../market-session/market-session.service.js";
import type { Clock } from "../../shared/clock/clock.js";
import type { OrderInput } from "./oms.types.js";

export async function precheckOrder(connection: PoolConnection, input: OrderInput, sessions: MarketSessionService, clock: Clock): Promise<void> {
  const price = Number(input.price);
  if (price < 23000 || price > 27000 || price % 100 !== 0) {
    throw new ApplicationError(422, "INVALID_PRICE", "Giá không phù hợp với cấu hình giao dịch.", { price, tickSize: 100 });
  }
  const database: Database = {
    async query<T extends RowDataPacket[]>(sql: string, parameters: ExecuteValues = []): Promise<T> {
      const [rows] = await connection.execute<T>(sql, parameters);
      return rows;
    },
    async ping() { await connection.query("SELECT 1"); },
    async close() { throw new Error("Cannot close transaction connection"); },
    async transaction() { throw new Error("Nested transaction is not supported"); },
  };
  const securities = new SecurityService(new MySqlSecurityRepository(database));
  const accounts = new AccountService(new MySqlAccountRepository(database), securities);
  const availability = await accounts.checkAvailability({ ...input, price: Number(input.price) });
  if (!availability.valid) {
    throw new ApplicationError(422, availability.reasonCode!, "Tài khoản hoặc tài sản không đáp ứng điều kiện đặt lệnh.");
  }
  if (input.securityId !== "sec-001") throw new ApplicationError(422, "SECURITY_NOT_TRADABLE", "Chứng khoán ngoài phạm vi demo.");
  const session = await new OrderSessionValidator(securities, sessions, clock).validate({ securityId: input.securityId, orderType: input.orderType, side: input.side, quantity: input.quantity });
  if (!session.valid) throw new ApplicationError(422, "INVALID_SESSION", "Phiên không cho phép đặt lệnh LO.");
}
