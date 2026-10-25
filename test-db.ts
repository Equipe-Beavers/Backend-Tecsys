import "dotenv/config";
import { Pool } from "pg";
import fs from "fs";

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(process.env.DB_SSLROOTCERT || "./global-bundle.pem").toString(),
    },
});

async function testConnection() {
    try {
        console.log("Tentando conectar ao RDS...");
        const client = await pool.connect();
        const res = await client.query("SELECT NOW()");
        console.log("✅ Conexão bem-sucedida!", res.rows[0]);
        client.release();
        await pool.end();
    } catch (err) {
        console.error("❌ Erro na conexão:", err);
    }
}

testConnection();