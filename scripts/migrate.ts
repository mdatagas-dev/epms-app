import { readFile } from "node:fs/promises";

import { getMigrations } from "better-auth/db/migration";

import { auth } from "../lib/auth-config.ts";
import { db } from "../lib/pool.ts";

const { runMigrations } = await getMigrations(auth.options);
await runMigrations();

const engineeringSchema = await readFile(new URL("../db/001_engineering.sql", import.meta.url), "utf8");
await db.query(engineeringSchema);
await db.end();

console.log("Database schema is ready.");
