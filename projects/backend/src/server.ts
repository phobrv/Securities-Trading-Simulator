import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createDatabase } from "./infrastructure/database.js";
import { MySqlSecurityRepository } from "./modules/security-master/security.repository.js";
import { SecurityService } from "./modules/security-master/security.service.js";
import { SystemService } from "./modules/system/system.service.js";

const database = createDatabase();
const app = createApp({
  systemService: new SystemService(database),
  securityService: new SecurityService(new MySqlSecurityRepository(database)),
});
const server = app.listen(env.port, () => {
  console.info(`Backend đang lắng nghe tại http://localhost:${env.port}`);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`Đã nhận ${signal}; đang đóng backend.`);

  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
