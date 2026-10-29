// Isolated HTTP process used by the restart integration test.
import { createDatabase } from "../../src/infrastructure/database.js";
import { orderApiApp, orderApiService } from "./order-api.js";

const database = createDatabase();
const app = orderApiApp(orderApiService(database, process.env.TEST_REQUESTER!));
const server = app.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") console.log(`READY ${address.port}`);
});
process.on("SIGTERM", () => server.close(() => void database.close().then(() => process.exit(0))));
