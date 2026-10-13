import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import "dotenv/config";

/** Onde ficam os arquivos da Overture Maps (bucket público da AWS). */
export const overtureBucket = process.env.OVERTURE_BUCKET ?? "s3://overturemaps-us-west-2/release";
/** Release da Overture (ex.: 2026-09-17.0). Vazio = a mais recente do bucket. */
export const overtureRelease = process.env.OVERTURE_RELEASE?.trim() || null;

let connection: Promise<DuckDBConnection> | null = null;

async function connect(): Promise<DuckDBConnection> {
    const instance = await DuckDBInstance.create(":memory:");
    const duckdb = await instance.connect();

    if (overtureBucket.startsWith("s3://")) {
        await duckdb.run("INSTALL httpfs; LOAD httpfs;");
        await duckdb.run("SET s3_region='us-west-2';");
        await duckdb.run("SET enable_http_metadata_cache=true;");
    }
    // Lê a geometria como WKB puro, sem depender da extensão spatial.
    try {
        await duckdb.run("SET enable_geoparquet_conversion=false;");
    } catch {
        // Versões antigas do DuckDB não têm essa opção.
    }
    return duckdb;
}

/** Conexão DuckDB usada para ler os arquivos GeoParquet da Overture Maps. */
export function getDuckDB(): Promise<DuckDBConnection> {
    connection ??= connect().catch((error) => {
        connection = null;
        throw error;
    });
    return connection;
}
