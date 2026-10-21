import { env } from "../config/env.js";
import type {
    BoundingBoxDTO,
    Building,
    BuildingMaterial,
    BuildingOnLinkRow,
    CachedBuilding,
    CalculateObstructionDTO,
    LinkDTO,
    LinkObstruction,
    ListBuildingsDTO,
    ListBuildingsResult,
} from "../interface/BuildingDTO.js";
import type { BuildingObstacle, PropagationParameters } from "../interface/PropagationDTO.js";
import { BuildingIndex } from "../utils/BuildingIndex.js";
import { BUILDING_MATERIALS, BuildingUtils } from "../utils/BuildingUtils.js";
import { GeometryUtils } from "../utils/GeometryUtils.js";
import { PropagationUtils } from "../utils/PropagationUtils.js";
import { BuildingSourceError, OvertureService } from "./OvertureService.js";

const DEFAULT_FREQUENCY_MHZ = 915;
const DEFAULT_LIMIT = 1000;
const DEFAULT_MAX_LOSS_DB = 40;
const MAX_BBOX_SIDE_DEGREES = 0.1;
const MAX_LINKS_SIDE_DEGREES = 0.3;
const TILE_SIZE_DEGREES = 0.02;
const TILE_MARGIN_DEGREES = 0.002;

interface CacheEntry {
    buildings: CachedBuilding[];
    release: string;
    loadedAt: number;
}

export interface BuildingsAround {
    index: BuildingIndex | null;
    radiusM: number;
    error: string | null;
}

export class BuildingService {
    private static cache = new Map<string, CacheEntry>();
    private static cachedCount = 0;
    private static inFlight = new Map<string, Promise<void>>();

    private overtureService = new OvertureService();
    private propagationUtils = new PropagationUtils();
    private buildingUtils = new BuildingUtils();
    private geometryUtils = new GeometryUtils();
    static clearCache(): void {
        BuildingService.cache.clear();
        BuildingService.cachedCount = 0;
    }

    validateArea(area: BoundingBoxDTO, maxSideDegrees: number, label = "Bounding box"): void {
        if (area.minLatitude > area.maxLatitude || area.minLongitude > area.maxLongitude) {
            throw new Error(`${label} inválido.`);
        }
        if (
            area.maxLatitude - area.minLatitude > maxSideDegrees ||
            area.maxLongitude - area.minLongitude > maxSideDegrees
        ) {
            throw new Error(`${label} muito grande. Cada lado pode ter no máximo ${maxSideDegrees}°.`);
        }
    }

    private getCached(key: string): CacheEntry | null {
        const entry = BuildingService.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.loadedAt > env.buildings.cacheTtlMinutes * 60000) {
            BuildingService.cache.delete(key);
            BuildingService.cachedCount -= entry.buildings.length;
            return null;
        }

        BuildingService.cache.delete(key);
        BuildingService.cache.set(key, entry);
        return entry;
    }

    private store(key: string, entry: CacheEntry): void {
        const previous = BuildingService.cache.get(key);
        if (previous) BuildingService.cachedCount -= previous.buildings.length;
        BuildingService.cache.set(key, entry);
        BuildingService.cachedCount += entry.buildings.length;

        for (const [oldKey, oldEntry] of BuildingService.cache) {
            if (BuildingService.cachedCount <= env.buildings.cacheMaxBuildings || oldKey === key) break;
            BuildingService.cache.delete(oldKey);
            BuildingService.cachedCount -= oldEntry.buildings.length;
        }
    }

    private async loadTiles(keys: string[]): Promise<void> {
        const release = await this.overtureService.getRelease();
        const bounds = keys.map((key) => this.buildingUtils.TileBounds(key, TILE_SIZE_DEGREES));
        const area: BoundingBoxDTO = {
            minLatitude: Math.min(...bounds.map((b) => b.minLatitude)),
            maxLatitude: Math.max(...bounds.map((b) => b.maxLatitude)),
            minLongitude: Math.min(...bounds.map((b) => b.minLongitude)),
            maxLongitude: Math.max(...bounds.map((b) => b.maxLongitude)),
        };

        const rows = await this.overtureService.readBuildings(release, area);
        const byTile = new Map<string, CachedBuilding[]>(keys.map((key) => [key, []]));

        for (const row of rows) {
            const building = this.buildingUtils.Normalize(row, release, env.buildings.defaultFloors);
            if (!building) continue;
            const centerLon = (building.bbox.minLongitude + building.bbox.maxLongitude) / 2;
            const centerLat = (building.bbox.minLatitude + building.bbox.maxLatitude) / 2;
            const key = `${Math.floor(centerLon / TILE_SIZE_DEGREES)}:${Math.floor(centerLat / TILE_SIZE_DEGREES)}`;
            byTile.get(key)?.push(building);
        }

        const loadedAt = Date.now();
        for (const [key, buildings] of byTile) this.store(key, { buildings, release, loadedAt });
    }

    async getBuildingsInArea(area: BoundingBoxDTO): Promise<{ buildings: CachedBuilding[]; release: string }> {
        const expanded: BoundingBoxDTO = {
            minLatitude: area.minLatitude - TILE_MARGIN_DEGREES,
            maxLatitude: area.maxLatitude + TILE_MARGIN_DEGREES,
            minLongitude: area.minLongitude - TILE_MARGIN_DEGREES,
            maxLongitude: area.maxLongitude + TILE_MARGIN_DEGREES,
        };
        const keys = this.buildingUtils.TileKeys(expanded, TILE_SIZE_DEGREES);

        const missing = keys.filter((key) => !this.getCached(key));
        const toLoad = missing.filter((key) => !BuildingService.inFlight.has(key));
        const waiting = new Set(missing.filter((key) => BuildingService.inFlight.has(key)).map((key) => BuildingService.inFlight.get(key)!));

        if (toLoad.length > 0) {
            const loading = this.loadTiles(toLoad).finally(() => {
                for (const key of toLoad) BuildingService.inFlight.delete(key);
            });
            for (const key of toLoad) BuildingService.inFlight.set(key, loading);
            waiting.add(loading);
        }
        await Promise.all(waiting);

        const buildings: CachedBuilding[] = [];
        let release = "";
        for (const key of keys) {
            const entry = BuildingService.cache.get(key);
            if (!entry) continue;
            release ||= entry.release;
            for (const building of entry.buildings) {
                if (this.buildingUtils.Intersects(building.bbox, area)) buildings.push(building);
            }
        }
        return { buildings, release };
    }

    toBuilding(building: CachedBuilding, frequencyMhz: number): Building {
        const { polygons, bbox: _bbox, ...data } = building;
        return {
            ...data,
            perda_material_db: this.propagationUtils.Round1(
                this.buildingUtils.MaterialLossDb(building.codigo_material, frequencyMhz),
            ),
            geometria: this.geometryUtils.ToGeoJson(polygons),
        };
    }

    async listBuildings(query: ListBuildingsDTO): Promise<ListBuildingsResult> {
        this.validateArea(query, MAX_BBOX_SIDE_DEGREES);

        const { buildings, release } = await this.getBuildingsInArea(query);
        const frequencyMhz = query.frequencyMhz ?? DEFAULT_FREQUENCY_MHZ;
        const limit = query.limit ?? DEFAULT_LIMIT;

        return {
            data: buildings.slice(0, limit).map((building) => this.toBuilding(building, frequencyMhz)),
            total: buildings.length,
            fonte: "Overture Maps Foundation (buildings)",
            versao_fonte: release,
        };
    }

    listBuildingMaterials(): BuildingMaterial[] {
        return BUILDING_MATERIALS;
    }
    async loadIndexAround(latitude: number, longitude: number, radiusM: number): Promise<BuildingIndex> {
        const area = this.buildingUtils.AroundPoint(latitude, longitude, radiusM);
        const { buildings } = await this.getBuildingsInArea(area);
        return new BuildingIndex(buildings, latitude, longitude);
    }


    async loadBuildingsAround(latitude: number, longitude: number, rangeM: number): Promise<BuildingsAround> {
        const radiusM = Math.max(1, Math.min(rangeM, env.buildings.maxRadiusM));
        try {
            const index = await this.loadIndexAround(latitude, longitude, radiusM);
            return { index, radiusM, error: null };
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error("Não foi possível consultar as edificações da região:", reason);
            return { index: null, radiusM, error: reason };
        }
    }

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

    async calculateBuildingObstruction(obstructionData: CalculateObstructionDTO): Promise<LinkObstruction[]> {
        const ids = obstructionData.links.map((link) => link.id);
        if (new Set(ids).size !== ids.length) {
            throw new Error("Os ids dos enlaces devem ser únicos.");
        }

        const points = obstructionData.links.flatMap((link) => [link.origin, link.destination]);
        const area: BoundingBoxDTO = {
            minLatitude: Math.min(...points.map((p) => p.latitude)),
            maxLatitude: Math.max(...points.map((p) => p.latitude)),
            minLongitude: Math.min(...points.map((p) => p.longitude)),
            maxLongitude: Math.max(...points.map((p) => p.longitude)),
        };
        this.validateArea(area, MAX_LINKS_SIDE_DEGREES, "Área dos enlaces");

        const { buildings } = await this.getBuildingsInArea(area);
        const index = new BuildingIndex(
            buildings,
            (area.minLatitude + area.maxLatitude) / 2,
            (area.minLongitude + area.maxLongitude) / 2,
        );
        const maxLossDb = obstructionData.max_loss_db ?? DEFAULT_MAX_LOSS_DB;
        const rows = index.Crossings(obstructionData.links, obstructionData.frequency_mhz);
        const obstaclesByLink = this.groupObstaclesByLink(rows);

        return obstructionData.links.map((link) => this.summarizeLink(link, rows, obstaclesByLink, obstructionData.frequency_mhz, maxLossDb));
    }

    summarizeLink(
        link: LinkDTO,
        rows: BuildingOnLinkRow[],
        obstaclesByLink: Map<string, BuildingObstacle[]>,
        frequencyMhz: number,
        maxLossDb: number,
    ): LinkObstruction {
        const linkRows = rows.filter((row) => row.id === link.id);
        const distanceM = this.propagationUtils.MetersDistance(
            link.origin.latitude,
            link.origin.longitude,
            link.destination.latitude,
            link.destination.longitude,
        );

        const params = {
            frequencyMhz,
            gatewayHeightM: link.origin.height_m,
            deviceHeightM: link.destination.height_m,
        } as PropagationParameters;
        const totalLossDb = distanceM > 0
            ? this.propagationUtils.BuildingsLossDb(obstaclesByLink.get(link.id) ?? [], distanceM, params)
            : 0;

        const buildings = linkRows.map((row) => {
            const blocks = row.altura_m > row.altura_linha_m;
            return {
                id_building: row.id_edificacao,
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
    }
}

export { BuildingSourceError };
