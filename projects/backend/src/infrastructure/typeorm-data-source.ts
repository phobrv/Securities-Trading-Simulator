import { DataSource } from "typeorm";

import { CreateSecurityMaster1792800000000 } from "../database/migrations/1792800000000-create-security-master.js";
import { SeedSecurityMaster1792800001000 } from "../database/migrations/1792800001000-seed-security-master.js";
import { CreateAccounts1792800002000 } from "../database/migrations/1792800002000-create-accounts.js";
import { SeedAccounts1792800003000 } from "../database/migrations/1792800003000-seed-accounts.js";
import { CreateOms1792800004000 } from "../database/migrations/1792800004000-create-oms.js";
import { CreateIdempotency1792800005000 } from "../database/migrations/1792800005000-create-idempotency.js";
import { CreateCashLedger1792800006000 } from "../database/migrations/1792800006000-create-cash-ledger.js";
import { SeedCashLedger1792800007000 } from "../database/migrations/1792800007000-seed-cash-ledger.js";
import { CreatePortfolio1792800008000 } from "../database/migrations/1792800008000-create-portfolio.js";
import { CreateMarginSimulation1792800009000 } from "../database/migrations/1792800009000-create-margin-simulation.js";
import { env } from "../config/env.js";

const migrationDataSource = new DataSource({
  type: "mysql",
  host: env.database.host,
  port: env.database.port,
  username: env.database.user,
  password: env.database.password,
  database: env.database.name,
  connectTimeout: env.database.connectTimeoutMs,
  migrationsTableName: "typeorm_migrations",
  migrationsTransactionMode: "each",
  migrations: [
    CreateSecurityMaster1792800000000,
    SeedSecurityMaster1792800001000,
    CreateAccounts1792800002000,
    SeedAccounts1792800003000,
    CreateOms1792800004000,
    CreateIdempotency1792800005000,
    CreateCashLedger1792800006000,
    SeedCashLedger1792800007000,
    CreatePortfolio1792800008000,
    CreateMarginSimulation1792800009000,
  ],
});

export default migrationDataSource;
