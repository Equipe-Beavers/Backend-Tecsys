import { pool } from "../database/pool.js";
import { getDuckDB, overtureBucket, overtureRelease } from "../database/duckdb.js";
import {
    applyDefaultBuildingMaterialQuery,
    findBuildingByIdQuery,
    findBuildingMaterialQuery,
    findBuildingsOnLinksQuery,
    findStudyExtentQuery,
    getDefaultBuildingMaterialQuery,
    insertImportedAreaQuery,
    isAreaImportedQuery,
    upsertBuildingsQuery,
    hasBuildingsNearQuery,
    listBuildingMaterialsQuery,
    listBuildingsQuery,
    unsetDefaultBuildingMaterialQuery,
    updateBuildingMaterialQuery,
    updateBuildingQuery,
} from "../database/queries.js";
import type {
    BoundingBoxDTO,
    Building,
    BuildingMaterial,
    BuildingOnLinkRow,
    CalculateObstructionDTO,
    ImportBuildingsDTO,
    ImportBuildingsResult,
    LinkDTO,
    LinkObstruction,
    ListBuildingsDTO,
    UpdateBuildingDTO,
    UpdateBuildingMaterialDTO,
} from "../interface/BuildingDTO.js";
import type { BuildingObstacle, PropagationParameters } from "../interface/PropagationDTO.js";
import { PropagationUtils } from "../utils/PropagationUtils.js";
import { BuildingUtils } from "../utils/BuildingUtils.js";

/** Frequência usada quando a requisição não informa uma (LoRaWAN AU915 no Brasil). */
const DEFAULT_FREQUENCY_MHZ = 915;
const DEFAULT_LIMIT = 1000;
const DEFAULT_MAX_LOSS_DB = 40;
/** Evita varrer uma cidade inteira numa só requisição (~0,1° ≈ 11 km). */
const MAX_BBOX_SIDE_DEGREES = 0.1;
/** Quantidade de enlaces enviados ao banco por consulta. */
const LINKS_PER_QUERY = 1000;
/** Maior área importada numa requisição (~0,3° ≈ 33 km de lado). */
const MAX_IMPORT_SIDE_DEGREES = 0.3;
/** Folga em volta dos pontos do estudo (~500 m). */
const STUDY_MARGIN_DEGREES = 0.005;
const BUILDINGS_PER_INSERT = 1000;

export class BuildingService {
    private propagationUtils: PropagationUtils;
    private buildingUtils: BuildingUtils;

    constructor() {
        this.propagationUtils = new PropagationUtils();
        this.buildingUtils = new BuildingUtils();
    }

    async listBuildings(query: ListBuildingsDTO): Promise<{ data: Building[]; total: number }> {
        if (query.minLatitude > query.maxLatitude || query.minLongitude > query.maxLongitude) {
            throw new Error("Bounding box inválido.");
        }
        if (
            query.maxLatitude - query.minLatitude > MAX_BBOX_SIDE_DEGREES ||
            query.maxLongitude - query.minLongitude > MAX_BBOX_SIDE_DEGREES
        ) {
            throw new Error(`Bounding box muito grande. Cada lado pode ter no máximo ${MAX_BBOX_SIDE_DEGREES}°.`);
        }

        const result = await pool.query(listBuildingsQuery, [
            query.minLatitude,
            query.maxLatitude,
            query.minLongitude,
            query.maxLongitude,
            query.frequencyMhz ?? DEFAULT_FREQUENCY_MHZ,
            query.limit ?? DEFAULT_LIMIT,
        ]);

        return {
            data: result.rows.map(({ total: _total, ...row }) => ({
                ...row,
                id_edificacao: Number(row.id_edificacao),
            }) as Building),
            total: result.rows[0]?.total ?? 0,
        };
    }

    async getBuilding(id: number, frequencyMhz?: number): Promise<Building> {
        const result = await pool.query(findBuildingByIdQuery, [id, frequencyMhz ?? DEFAULT_FREQUENCY_MHZ]);
        const row = result.rows[0];
        if (!row) throw new Error("Edificação não encontrada.");
        return { ...row, id_edificacao: Number(row.id_edificacao) } as Building;
    }

    /** Correção manual de altura e/ou material. A próxima carga do ETL preserva a correção. */
    async updateBuilding(id: number, buildingData: UpdateBuildingDTO): Promise<Building> {
        const materialCode = buildingData.codigo_material?.trim().toUpperCase();

        if (materialCode) {
            const material = await pool.query(findBuildingMaterialQuery, [materialCode]);
            if (material.rows.length === 0) throw new Error(`Material '${materialCode}' não encontrado.`);
        }

        const result = await pool.query(updateBuildingQuery, [
            id,
            buildingData.altura_m ?? null,
            materialCode ?? null,
        ]);
        if ((result.rowCount ?? 0) === 0) throw new Error("Edificação não encontrada.");

        return this.getBuilding(id);
    }

    async listBuildingMaterials(): Promise<BuildingMaterial[]> {
        const result = await pool.query(listBuildingMaterialsQuery);
        return result.rows as BuildingMaterial[];
    }

    /**
     * Ajusta as perdas de um material e/ou o define como padrão. Ao trocar o padrão, as
     * edificações sem material identificado (origem PADRAO) passam a usar o novo padrão.
     */
    async updateBuildingMaterial(code: string, materialData: UpdateBuildingMaterialDTO): Promise<BuildingMaterial> {
        const materialCode = code.trim().toUpperCase();
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            if (materialData.padrao === true) {
                await client.query(unsetDefaultBuildingMaterialQuery, [materialCode]);
            }

            const result = await client.query(updateBuildingMaterialQuery, [
                materialCode,
                materialData.perda_db_900mhz ?? null,
                materialData.perda_db_2400mhz ?? null,
                materialData.padrao ?? null,
            ]);

            const material = result.rows[0] as BuildingMaterial | undefined;
            if (!material) {
                await client.query("ROLLBACK");
                throw new Error("Material não encontrado.");
            }

            if (materialData.padrao === true) {
                await client.query(applyDefaultBuildingMaterialQuery, [materialCode]);
            }

            await client.query("COMMIT");
            return material;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    /** Edificações cruzadas por cada enlace. Divide em lotes para não montar consultas gigantes. */
    async findBuildingsOnLinks(links: LinkDTO[], frequencyMhz: number): Promise<BuildingOnLinkRow[]> {
        const rows: BuildingOnLinkRow[] = [];

        for (let start = 0; start < links.length; start += LINKS_PER_QUERY) {
            const payload = links.slice(start, start + LINKS_PER_QUERY).map((link) => ({
                id: link.id,
                origem_lat: link.origin.latitude,
                origem_lng: link.origin.longitude,
                origem_altura_m: link.origin.height_m,
                destino_lat: link.destination.latitude,
                destino_lng: link.destination.longitude,
                destino_altura_m: link.destination.height_m,
            }));

            const result = await pool.query(findBuildingsOnLinksQuery, [JSON.stringify(payload), frequencyMhz]);
            rows.push(...(result.rows as BuildingOnLinkRow[]));
        }

        return rows;
    }

    /** Indica se há edificações carregadas perto do ponto (raio padrão ~1 km). */
    async hasBuildingsNear(latitude: number, longitude: number, radiusDegrees = 0.01): Promise<boolean> {
        const result = await pool.query(hasBuildingsNearQuery, [latitude, longitude, radiusDegrees]);
        return result.rows[0]?.existe ?? false;
    }

    /** Converte as linhas do banco em obstáculos agrupados por enlace. */
    groupObstaclesByLink(rows: BuildingOnLinkRow[]): Map<string, BuildingObstacle[]> {
        const byLink = new Map<string, BuildingObstacle[]>();
        for (const row of rows) {
            const list = byLink.get(row.id) ?? [];
            list.push({
                entryDistanceM: row.distancia_origem_m,
                insideLengthM: row.trecho_m,
                heightM: row.altura_m,
                materialLossDb: row.perda_material_db,
            });
            byLink.set(row.id, list);
        }
        return byLink;
    }

    /**
     * Perda extra causada por edificações em cada enlace gateway → ativo, com o mesmo modelo da
     * mancha de propagação (PropagationUtils.BuildingsLossDb). `loss_db` de cada edificação é a
     * perda para atravessá-la.
     */
    async calculateBuildingObstruction(obstructionData: CalculateObstructionDTO): Promise<LinkObstruction[]> {
        const ids = obstructionData.links.map((link) => link.id);
        if (new Set(ids).size !== ids.length) {
            throw new Error("Os ids dos enlaces devem ser únicos.");
        }

        const maxLossDb = obstructionData.max_loss_db ?? DEFAULT_MAX_LOSS_DB;
        const rows = await this.findBuildingsOnLinks(obstructionData.links, obstructionData.frequency_mhz);
        const obstaclesByLink = this.groupObstaclesByLink(rows);

        return obstructionData.links.map((link) => {
            const linkRows = rows.filter((row) => row.id === link.id);
            const distanceM = this.propagationUtils.MetersDistance(
                link.origin.latitude,
                link.origin.longitude,
                link.destination.latitude,
                link.destination.longitude,
            );

            const params = {
                frequencyMhz: obstructionData.frequency_mhz,
                gatewayHeightM: link.origin.height_m,
                deviceHeightM: link.destination.height_m,
            } as PropagationParameters;
            const totalLossDb = distanceM > 0
                ? this.propagationUtils.BuildingsLossDb(obstaclesByLink.get(link.id) ?? [], distanceM, params)
                : 0;

            const buildings = linkRows.map((row) => {
                const blocks = row.altura_m > row.altura_linha_m;
                return {
                    id_building: Number(row.id_edificacao),
                    height_m: row.altura_m,
                    line_height_m: this.propagationUtils.Round1(row.altura_linha_m),
                    distance_from_origin_m: this.propagationUtils.Round1(row.distancia_origem_m),
                    material_code: row.codigo_material,
                    blocks,
                    loss_db: blocks ? this.propagationUtils.Round1(2 * row.perda_material_db + 0.6 * row.trecho_m) : 0,
                };
            });

            return {
                id: link.id,
                buildings_count: buildings.length,
                blocking_count: buildings.filter((building) => building.blocks).length,
                total_loss_db: this.propagationUtils.Round1(Math.min(totalLossDb, maxLossDb)),
                buildings,
            };
        });
    }

    /** Release da Overture: a do .env (OVERTURE_RELEASE) ou a mais recente do bucket. */
    async getOvertureRelease(): Promise<string> {
        if (overtureRelease) return overtureRelease;
        const duckdb = await getDuckDB();
        const result = await duckdb.runAndReadAll(
            `SELECT DISTINCT split_part(split_part(file, '/release/', 2), '/', 1) AS release
             FROM glob('${overtureBucket}/*/theme=buildings/type=building/*')
             ORDER BY release DESC LIMIT 1`,
        );
        const release = result.getRowObjectsJS()[0]?.release;
        if (!release) throw new Error("Nenhuma release da Overture Maps encontrada. Defina OVERTURE_RELEASE no .env.");
        return String(release);
    }

    /**
     * Importa da Overture Maps as edificações de uma área (altura, largura, comprimento e material)
     * e grava na tabela `edificacoes`. Áreas já importadas são puladas, a não ser com `force`.
     */
    async importBuildings(area: ImportBuildingsDTO): Promise<ImportBuildingsResult> {
        if (area.minLatitude > area.maxLatitude || area.minLongitude > area.maxLongitude) {
            throw new Error("Bounding box inválido.");
        }
        if (
            area.maxLatitude - area.minLatitude > MAX_IMPORT_SIDE_DEGREES ||
            area.maxLongitude - area.minLongitude > MAX_IMPORT_SIDE_DEGREES
        ) {
            throw new Error(`Área muito grande. Cada lado pode ter no máximo ${MAX_IMPORT_SIDE_DEGREES}°.`);
        }

        const bbox = [area.minLatitude, area.maxLatitude, area.minLongitude, area.maxLongitude];
        if (!area.force) {
            const imported = await pool.query(isAreaImportedQuery, bbox);
            if (imported.rows[0]?.importada) {
                return { versao_fonte: "", areas_processadas: 0, edificacoes_importadas: 0, ja_importada: true };
            }
        }

        const release = await this.getOvertureRelease();
        const defaultMaterial = (await pool.query(getDefaultBuildingMaterialQuery)).rows[0]?.codigo ?? "CONCRETO";
        const batch = new Date().toISOString().slice(0, 10).replaceAll("-", "_");
        const tiles = this.buildingUtils.Tiles(area);
        let total = 0;

        for (const tile of tiles) {
            const rows = await this.extractOvertureBuildings(release, tile);
            const buildings = rows.map((row) => {
                const height = this.buildingUtils.EstimateHeight(row.height, row.num_floors, row.subtype, row.class);
                const material = this.buildingUtils.ClassifyMaterial(
                    row.facade_material,
                    row.subtype,
                    row.class,
                    height.floors,
                    defaultMaterial,
                );
                return {
                    id: row.id,
                    fonte_original: row.fonte_original,
                    subtipo: row.subtype,
                    classe: row.class,
                    altura_m: height.heightM,
                    origem_altura: height.source,
                    pavimentos: height.floors,
                    codigo_material: material.code,
                    origem_material: material.source,
                    material_fachada_original: row.facade_material,
                    material_telhado_original: row.roof_material,
                    wkb_hex: row.wkb_hex,
                };
            });

            for (let start = 0; start < buildings.length; start += BUILDINGS_PER_INSERT) {
                const result = await pool.query(upsertBuildingsQuery, [
                    JSON.stringify(buildings.slice(start, start + BUILDINGS_PER_INSERT)),
                    release,
                    batch,
                ]);
                total += result.rowCount ?? 0;
            }
        }

        await pool.query(insertImportedAreaQuery, [...bbox, release, total]);
        return { versao_fonte: release, areas_processadas: tiles.length, edificacoes_importadas: total, ja_importada: false };
    }

    /**
     * Garante que as edificações em volta de um ponto estejam no banco (raio padrão ~2 km).
     * Se a importação falhar (sem internet, por exemplo), o cálculo segue sem as edificações.
     */
    async ensureBuildingsAround(latitude: number, longitude: number, radiusDegrees = 0.02): Promise<void> {
        try {
            await this.importBuildings({
                minLatitude: latitude - radiusDegrees,
                maxLatitude: latitude + radiusDegrees,
                minLongitude: longitude - radiusDegrees,
                maxLongitude: longitude + radiusDegrees,
            });
        } catch (error) {
            console.error("Não foi possível importar as edificações da região:", error);
        }
    }

    /** Garante as edificações da área do estudo; se falhar, o cálculo segue sem elas. */
    async ensureStudyBuildings(idStudy: number): Promise<void> {
        try {
            await this.importStudyBuildings(idStudy);
        } catch (error) {
            console.error("Não foi possível importar as edificações do estudo:", error);
        }
    }

    /** Importa as edificações em volta de todos os pontos de um estudo. */
    async importStudyBuildings(idStudy: number, force = false): Promise<ImportBuildingsResult> {
        const extent = (await pool.query(findStudyExtentQuery, [idStudy])).rows[0];
        if (!extent || extent.min_latitude == null) throw new Error("O estudo não possui pontos.");

        return this.importBuildings({
            minLatitude: extent.min_latitude - STUDY_MARGIN_DEGREES,
            maxLatitude: extent.max_latitude + STUDY_MARGIN_DEGREES,
            minLongitude: extent.min_longitude - STUDY_MARGIN_DEGREES,
            maxLongitude: extent.max_longitude + STUDY_MARGIN_DEGREES,
            force,
        });
    }

    /** Lê da Overture as edificações cujo centro está dentro da área (cada prédio entra em uma área só). */
    async extractOvertureBuildings(release: string, tile: BoundingBoxDTO) {
        const duckdb = await getDuckDB();
        const result = await duckdb.runAndReadAll(
            `SELECT
                id,
                hex(geometry) AS wkb_hex,
                subtype,
                class,
                height,
                num_floors,
                facade_material,
                roof_material,
                sources[1].dataset AS fonte_original
             FROM read_parquet('${overtureBucket}/${release}/theme=buildings/type=building/*', hive_partitioning=1)
             WHERE bbox.xmin <= ? AND bbox.xmax >= ? AND bbox.ymin <= ? AND bbox.ymax >= ?
               AND (bbox.xmin + bbox.xmax) / 2 >= ? AND (bbox.xmin + bbox.xmax) / 2 < ?
               AND (bbox.ymin + bbox.ymax) / 2 >= ? AND (bbox.ymin + bbox.ymax) / 2 < ?
               AND COALESCE(is_underground, FALSE) = FALSE`,
            [
                tile.maxLongitude, tile.minLongitude, tile.maxLatitude, tile.minLatitude,
                tile.minLongitude, tile.maxLongitude, tile.minLatitude, tile.maxLatitude,
            ],
        );

        return result.getRowObjectsJS().map((row) => ({
            id: String(row.id),
            wkb_hex: String(row.wkb_hex),
            subtype: (row.subtype as string | null) ?? null,
            class: (row.class as string | null) ?? null,
            height: row.height == null ? null : Number(row.height),
            num_floors: row.num_floors == null ? null : Number(row.num_floors),
            facade_material: (row.facade_material as string | null) ?? null,
            roof_material: (row.roof_material as string | null) ?? null,
            fonte_original: (row.fonte_original as string | null) ?? null,
        }));
    }
}
