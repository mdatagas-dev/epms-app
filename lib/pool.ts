import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  epmsPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  return new Pool({ connectionString, max: 10 });
}

export const db = globalForDatabase.epmsPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.epmsPool = db;
}
