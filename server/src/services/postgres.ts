import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool() {
  if (pool) return pool;

  const hasConfig = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
  if (!hasConfig) {
    throw new Error("PostgreSQL is not configured.");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
  return getPool().query<T>(text, params);
}
