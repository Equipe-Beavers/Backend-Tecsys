import "dotenv/config";
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
    if (pool) return pool;

    pool = new Pool({
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 10,
    });

    return pool;
}

export async function closePool(): Promise<void> {
    await pool?.end();
    pool = null;
}