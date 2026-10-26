import { readFileSync } from "node:fs";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

function construirConfiguracaoSsl() {
    const modo = env.database.sslMode;
    if (modo === "disable") return undefined;
    if (modo === "verify-ca" || modo === "verify-full") {
        return {
            rejectUnauthorized: true,
            ...(env.database.sslRootCert
                ? { ca: readFileSync(env.database.sslRootCert, "utf-8") }
                : {}),
        };
    }
    return { rejectUnauthorized: false };
}

export const pool = new Pool({
    database: env.database.name,
    user: env.database.user,
    password: env.database.password,
    host: env.database.host,
    port: env.database.port,
    ssl: construirConfiguracaoSsl(),
    max: 10,
});

export async function closePool(): Promise<void> {
    await pool.end();
}
