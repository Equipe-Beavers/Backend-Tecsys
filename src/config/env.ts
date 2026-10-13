import "dotenv/config";

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("<")) {
        return fallback;
    }
    return value;
}

export const env = {
    database: {
        name: optional("DB_NAME", "postgres"),
        user: optional("DB_USER", "postgres"),
        password: optional("DB_PASSWORD", "postgres"),
        host: optional("DB_HOST", "localhost"),
        port: Number(optional("DB_PORT", "5432")),
        ssl: process.env.DB_SSL?.toLowerCase() === "true",
    },
    port: Number(optional("PORT", "3000")),
};
