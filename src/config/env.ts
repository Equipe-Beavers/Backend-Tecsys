import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("<")) {
        throw new Error(`Variável de ambiente obrigatória ausente ou inválida: ${name}`);
    }
    return value;
}

export const env = {
    database: {
        name: required("DB_NAME"),
        user: required("DB_USER"),
        password: required("DB_PASSWORD"),
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        ssl: process.env.DB_SSL?.toLowerCase() === "true",
    },
    port: Number(process.env.PORT ?? 3000),
};
