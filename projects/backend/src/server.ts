import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createDatabase } from "./infrastructure/database.js";
import { FixedClock } from "./shared/clock/fixed-clock.js";
import { SystemClock } from "./shared/clock/system-clock.js";
import { MySqlSecurityRepository } from "./modules/security-master/security.repository.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { MarketDataGateway } from "./modules/market-data/market-data.gateway.js";
import { MarketDataService } from "./modules/market-data/market-data.service.js";
import { RedisQuoteStore } from "./modules/market-data/redis-quote-store.js";
import { marketSessionConfigs } from "./modules/market-session/market-session.config.js";
import { MarketSessionService } from "./modules/market-session/market-session.service.js";
import { OrderSessionValidator } from "./modules/market-session/order-session-validator.js";
import { MatchingEngine } from "./modules/matching-simulator/matching-engine.js";
import { MatchingService } from "./modules/matching-simulator/matching.service.js";
import { SystemService } from "./modules/system/system.service.js";
import { MySqlAccountRepository } from "./modules/accounts/account.repository.js";
import { AccountService } from "./modules/accounts/account.service.js";
import { MySqlOmsRepository } from "./modules/oms/oms.repository.js";
import { OmsService } from "./modules/oms/oms.service.js";

const database = createDatabase();
const securityService = new SecurityService(
  new MySqlSecurityRepository(database),
);
const accountService = new AccountService(
  new MySqlAccountRepository(database),
  securityService,
);
const clock =
  env.simClock.mode === "FIXED"
    ? new FixedClock(env.simClock.fixedInstant!)
    : new SystemClock();
const marketSessionService = new MarketSessionService(
  marketSessionConfigs,
  clock,
  env.simClock.mode,
);
const orderSessionValidator = new OrderSessionValidator(
  securityService,
  marketSessionService,
  clock,
);
const quoteStore = new RedisQuoteStore(env.marketData.redisUrl);
const marketDataService = new MarketDataService(
  securityService,
  quoteStore,
  env.marketData.tradingDate,
);
const matchingService = new MatchingService(
  new MatchingEngine(),
  securityService,
  marketSessionService,
  clock,
  marketDataService,
);
const marketDataGateway = new MarketDataGateway(marketDataService);
const app = createApp({
  systemService: new SystemService(database),
  securityService,
  marketDataService,
  marketSessionService,
  orderSessionValidator,
  matchingService,
  accountService,
  omsService: env.omsDemoEnabled ? new OmsService(new MySqlOmsRepository(database), clock) : undefined,
});
const server = app.listen(env.port, () => {
  console.info(`Backend đang lắng nghe tại http://localhost:${env.port}`);
});

marketDataGateway.attach(server);
void startMarketData();

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`Đã nhận ${signal}; đang đóng backend.`);
  marketDataGateway.close();

  server.close(async () => {
    await quoteStore.close();
    await database.close();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function startMarketData(): Promise<void> {
  try {
    await quoteStore.start((quote) => marketDataGateway.broadcast(quote));
    await marketDataService.initializeSimulatorQuote(
      "sec-001",
      clock.now().toISOString(),
    );
  } catch (error) {
    console.error("Không thể khởi động Redis cho Market Data.", error);
  }
}
