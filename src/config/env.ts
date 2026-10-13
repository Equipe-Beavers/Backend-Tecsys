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
    /** Edificações consultadas sob demanda na Overture Maps (nada é gravado no banco). */
    buildings: {
        stacUrl: optional("OVERTURE_STAC_URL", "https://stac.overturemaps.org"),
        /** Release fixa (ex.: 2026-09-23.1). Vazio = a mais recente publicada no STAC. */
        release: process.env.OVERTURE_RELEASE?.trim() || null,
        queryTimeoutMs: Number(optional("BUILDINGS_QUERY_TIMEOUT_MS", "120000")),
        cacheTtlMinutes: Number(optional("BUILDINGS_CACHE_TTL_MIN", "1440")),
        /** Quantas edificações o cache em memória guarda no máximo. */
        cacheMaxBuildings: Number(optional("BUILDINGS_CACHE_MAX", "300000")),
        /** Pavimentos assumidos quando a fonte não informa altura nem pavimentos (× 3 m). */
        defaultFloors: Number(optional("BUILDING_DEFAULT_FLOORS", "2")),
        /** Raio em volta do gateway em que as edificações entram no cálculo de propagação. */
        maxRadiusM: Number(optional("BUILDINGS_MAX_RADIUS_M", "3000")),
    },
};
