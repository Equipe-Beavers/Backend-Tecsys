import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { env } from "../config/env.js";
import type { BoundingBoxDTO, OvertureBuildingRow } from "../interface/BuildingDTO.js";

const STAC_TIMEOUT_MS = 20000;
const STAC_RETRIES = 2;
/** Por quanto tempo a release "mais recente" do STAC é reaproveitada. */
const LATEST_RELEASE_TTL_MS = 6 * 60 * 60 * 1000;

/** Falha da fonte externa (rede, timeout, limite de requisições). Vira HTTP 503. */
export class BuildingSourceError extends Error {
    statusCode = 503;
}

/**
 * Leitura das edificações da Overture Maps (GeoParquet público na AWS), sob demanda.
 *
 * Para não varrer os ~500 arquivos globais (leva minutos), o catálogo STAC da Overture informa o
 * retângulo de cada arquivo; só os arquivos que tocam a área são lidos pelo DuckDB em memória,
 * que ainda filtra os row groups pela coluna `bbox`. Nada é gravado em disco nem no banco.
 */
export class OvertureService {
    private static connection: Promise<DuckDBConnection> | null = null;
    private static queue: Promise<unknown> = Promise.resolve();
    private static latest: { release: string; at: number } | null = null;
    private static fileBoxes = new Map<string, Promise<number[][]>>();
    private static fileHrefs = new Map<string, Promise<string>>();

    private static async connect(): Promise<DuckDBConnection> {
        const instance = await DuckDBInstance.create(":memory:");
        const duckdb = await instance.connect();
        await duckdb.run("INSTALL httpfs; LOAD httpfs;");
        await duckdb.run("SET s3_region='us-west-2';");
        await duckdb.run("SET enable_http_metadata_cache=true;");
        await duckdb.run("SET enable_object_cache=true;");
        try {
            // Lê a geometria como WKB puro, sem depender da extensão spatial.
            await duckdb.run("SET enable_geoparquet_conversion=false;");
        } catch {
            // Versões antigas do DuckDB não têm essa opção.
        }
        return duckdb;
    }

    private getConnection(): Promise<DuckDBConnection> {
        OvertureService.connection ??= OvertureService.connect().catch((error) => {
            OvertureService.connection = null;
            throw error;
        });
        return OvertureService.connection;
    }

    private async fetchJson<T>(url: string): Promise<T> {
        let lastError: unknown;
        for (let attempt = 0; attempt <= STAC_RETRIES; attempt++) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(STAC_TIMEOUT_MS) });
                if (response.ok) return (await response.json()) as T;
                lastError = new Error(`HTTP ${response.status}`);
                // Só vale tentar de novo em limite de requisições ou erro do servidor.
                if (response.status !== 429 && response.status < 500) break;
            } catch (error) {
                lastError = error;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        }
        const reason = lastError instanceof Error ? lastError.message : String(lastError);
        throw new BuildingSourceError(`Catálogo da Overture Maps indisponível (${reason}).`);
    }

    /** Release do .env (OVERTURE_RELEASE) ou a mais recente do catálogo STAC. */
    async getRelease(): Promise<string> {
        if (env.buildings.release) return env.buildings.release;
        const cached = OvertureService.latest;
        if (cached && Date.now() - cached.at < LATEST_RELEASE_TTL_MS) return cached.release;

        const catalog = await this.fetchJson<{ latest?: string }>(`${env.buildings.stacUrl}/catalog.json`);
        if (!catalog.latest) throw new BuildingSourceError("O catálogo da Overture Maps não informou a release mais recente.");
        OvertureService.latest = { release: catalog.latest, at: Date.now() };
        return catalog.latest;
    }

    /** Retângulo [xmin, ymin, xmax, ymax] de cada arquivo de edificações da release. */
    private getFileBoxes(release: string): Promise<number[][]> {
        let boxes = OvertureService.fileBoxes.get(release);
        if (!boxes) {
            boxes = this.fetchJson<{ extent: { spatial: { bbox: number[][] } } }>(
                `${env.buildings.stacUrl}/${release}/buildings/building/collection.json`,
            ).then((collection) => collection.extent.spatial.bbox.slice(1)); // o 1º é o mundo todo
            boxes.catch(() => OvertureService.fileBoxes.delete(release));
            OvertureService.fileBoxes.set(release, boxes);
        }
        return boxes;
    }

    private getFileHref(release: string, index: number): Promise<string> {
        const id = String(index).padStart(5, "0");
        const key = `${release}/${id}`;
        let href = OvertureService.fileHrefs.get(key);
        if (!href) {
            href = this.fetchJson<{ assets: { aws: { href: string; alternate?: { s3?: { href: string } } } } }>(
                `${env.buildings.stacUrl}/${release}/buildings/building/${id}/${id}.json`,
            ).then((item) => item.assets.aws.alternate?.s3?.href ?? item.assets.aws.href);
            href.catch(() => OvertureService.fileHrefs.delete(key));
            OvertureService.fileHrefs.set(key, href);
        }
        return href;
    }

    /** Arquivos GeoParquet que tocam a área. */
    async findFiles(release: string, area: BoundingBoxDTO): Promise<string[]> {
        const boxes = await this.getFileBoxes(release);
        const indexes = boxes
            .map((box, index) => ({ box, index }))
            .filter(({ box }) =>
                box[0]! <= area.maxLongitude && box[2]! >= area.minLongitude &&
                box[1]! <= area.maxLatitude && box[3]! >= area.minLatitude)
            .map(({ index }) => index);
        return Promise.all(indexes.map((index) => this.getFileHref(release, index)));
    }

    /** Uma consulta por vez na conexão DuckDB, com tempo limite. */
    private enqueue<T>(task: (duckdb: DuckDBConnection) => Promise<T>): Promise<T> {
        const run = OvertureService.queue.then(async () => {
            const duckdb = await this.getConnection();
            let timer: NodeJS.Timeout | undefined;
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    duckdb.interrupt();
                    reject(new BuildingSourceError(
                        `A Overture Maps não respondeu em ${Math.round(env.buildings.queryTimeoutMs / 1000)} s.`,
                    ));
                }, env.buildings.queryTimeoutMs);
            });
            try {
                return await Promise.race([task(duckdb), timeout]);
            } finally {
                clearTimeout(timer);
            }
        });
        OvertureService.queue = run.catch(() => undefined);
        return run;
    }

    /** Edificações (acima do solo) cujo retângulo toca a área. */
    async readBuildings(release: string, area: BoundingBoxDTO): Promise<OvertureBuildingRow[]> {
        const files = await this.findFiles(release, area);
        if (files.length === 0) return [];

        const fileList = files.map((file) => `'${file.replaceAll("'", "''")}'`).join(", ");
        try {
            return await this.enqueue(async (duckdb) => {
                const result = await duckdb.runAndReadAll(
                    `SELECT
                        id,
                        hex(geometry) AS wkb_hex,
                        subtype,
                        class,
                        height,
                        num_floors,
                        facade_material,
                        sources[1].dataset AS fonte_original
                     FROM read_parquet([${fileList}])
                     WHERE bbox.xmin <= $maxLon AND bbox.xmax >= $minLon
                       AND bbox.ymin <= $maxLat AND bbox.ymax >= $minLat
                       AND COALESCE(is_underground, FALSE) = FALSE`,
                    {
                        minLon: area.minLongitude,
                        maxLon: area.maxLongitude,
                        minLat: area.minLatitude,
                        maxLat: area.maxLatitude,
                    },
                );
                return result.getRowObjectsJS().map((row) => ({
                    id: String(row.id),
                    wkb_hex: String(row.wkb_hex),
                    subtype: (row.subtype as string | null) ?? null,
                    class: (row.class as string | null) ?? null,
                    height: row.height == null ? null : Number(row.height),
                    num_floors: row.num_floors == null ? null : Number(row.num_floors),
                    facade_material: (row.facade_material as string | null) ?? null,
                    fonte_original: (row.fonte_original as string | null) ?? null,
                }));
            });
        } catch (error) {
            if (error instanceof BuildingSourceError) throw error;
            const reason = error instanceof Error ? error.message : String(error);
            throw new BuildingSourceError(`Falha ao ler as edificações da Overture Maps: ${reason}`);
        }
    }
}
