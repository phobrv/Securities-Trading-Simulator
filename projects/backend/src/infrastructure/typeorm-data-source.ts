import { DataSource } from "typeorm";

import { CreateSecurityMaster1792800000000 } from "../database/migrations/1792800000000-create-security-master.js";
import { SeedSecurityMaster1792800001000 } from "../database/migrations/1792800001000-seed-security-master.js";
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
  ],
});

export default migrationDataSource;
