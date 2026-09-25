import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
    database: env.database.name,
    user: env.database.user,
    password: env.database.password,
    host: env.database.host,
    port: env.database.port,
    ssl: env.database.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
});

export async function closePool(): Promise<void> {
    await pool.end();
}
