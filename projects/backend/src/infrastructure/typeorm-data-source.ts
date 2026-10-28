import { DataSource } from "typeorm";

import { CreateSecurityMaster1792800000000 } from "../database/migrations/1792800000000-create-security-master.js";
import { SeedSecurityMaster1792800001000 } from "../database/migrations/1792800001000-seed-security-master.js";
import { CreateAccounts1792800002000 } from "../database/migrations/1792800002000-create-accounts.js";
import { SeedAccounts1792800003000 } from "../database/migrations/1792800003000-seed-accounts.js";
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
  migrations: [
    CreateSecurityMaster1792800000000,
    SeedSecurityMaster1792800001000,
    CreateAccounts1792800002000,
    SeedAccounts1792800003000,
  ],
});

export default migrationDataSource;
