import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createDatabase } from "./infrastructure/database.js";
import { MySqlSecurityRepository } from "./modules/security-master/security.repository.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { MarketDataGateway } from "./modules/market-data/market-data.gateway.js";
import { MarketDataService } from "./modules/market-data/market-data.service.js";
import { PriceSimulator } from "./modules/market-data/price-simulator.js";
import { RedisQuoteStore } from "./modules/market-data/redis-quote-store.js";
import { SystemService } from "./modules/system/system.service.js";

const database = createDatabase();
const securityService = new SecurityService(
  new MySqlSecurityRepository(database),
);
const quoteStore = new RedisQuoteStore(env.marketData.redisUrl);
const marketDataService = new MarketDataService(
  securityService,
  quoteStore,
  env.marketData.tradingDate,
);
const marketDataGateway = new MarketDataGateway(marketDataService);
const priceSimulator = new PriceSimulator(
  quoteStore,
  env.marketData.tradingDate,
  env.marketData.tickIntervalMs,
);
const app = createApp({
  systemService: new SystemService(database),
  securityService,
  marketDataService,
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
  priceSimulator.stop();
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
    priceSimulator.start();
  } catch (error) {
    console.error("Không thể khởi động Redis cho Market Data.", error);
  }
}
