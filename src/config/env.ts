import "dotenv/config";
import { resolve } from "node:path";

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("<")) {
        throw new Error(`Variável de ambiente obrigatória ausente ou inválida: ${name}`);
    }
    return value;
}

const sslMode = (
    process.env.DB_SSLMODE ??
    (process.env.DB_SSL?.toLowerCase() === "true" ? "require" : "disable")
).toLowerCase();
const validSslModes = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];
if (!validSslModes.includes(sslMode)) {
    throw new Error(`DB_SSLMODE inválido: ${sslMode}`);
}

export const env = {
    database: {
        name: required("DB_NAME"),
        user: required("DB_USER"),
        password: required("DB_PASSWORD"),
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        sslMode,
        sslRootCert: process.env.DB_SSLROOTCERT
            ? resolve(process.cwd(), process.env.DB_SSLROOTCERT)
            : undefined,
    },
    port: Number(process.env.PORT ?? 3000),
};
