import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("<")) {
        throw new Error(`Variável de ambiente obrigatória ausente ou inválida: ${name}`);
    }
    return value;
}

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("<")) {
        return fallback;
    }
    return value;
}

export const env = {
    database: {
        name: required("DB_NAME"),
        user: required("DB_USER"),
        password: required("DB_PASSWORD"),
        host: optional("DB_HOST", "localhost"),
        port: Number(optional("DB_PORT", "5432")),
        ssl: process.env.DB_SSL?.toLowerCase() === "true",
    },
    port: Number(optional("PORT", "3000")),
    /** Edificações consultadas sob demanda na Overture Maps  */
    buildings: {
        stacUrl: optional("OVERTURE_STAC_URL", "https://stac.overturemaps.org"),
        release: process.env.OVERTURE_RELEASE?.trim() || null,
        queryTimeoutMs: Number(optional("BUILDINGS_QUERY_TIMEOUT_MS", "120000")),
        cacheTtlMinutes: Number(optional("BUILDINGS_CACHE_TTL_MIN", "1440")),
        cacheMaxBuildings: Number(optional("BUILDINGS_CACHE_MAX", "300000")),
        defaultFloors: Number(optional("BUILDING_DEFAULT_FLOORS", "2")),
        maxRadiusM: Number(optional("BUILDINGS_MAX_RADIUS_M", "3000")),
    },
};
