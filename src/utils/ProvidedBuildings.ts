import type { BoundingBoxDTO, CachedBuilding } from "../interface/BuildingDTO.js";
import type { BuildingsAround } from "../services/BuildingService.js";
import { BuildingIndex } from "./BuildingIndex.js";
import { BuildingUtils } from "./BuildingUtils.js";
import type { PolygonRings, Ring } from "./GeometryUtils.js";

const MAX_ITEMS = 50000;
const METERS_PER_DEGREE = 111320;

export class ProvidedBuildings {
    private buildingUtils = new BuildingUtils();

    private constructor(
        readonly buildings: CachedBuilding[],
        readonly area: BoundingBoxDTO,
        readonly ignored: number,
        readonly polygon: Ring | null,
    ) {}

    static From(payload: unknown): ProvidedBuildings {
        const utils = new BuildingUtils();
        if (!isObject(payload)) throw new Error("O campo edificacoes deve ser um objeto.");

        const area = parseArea(payload.area);
        const polygon = parsePolygon(payload.poligono);
        if (!Array.isArray(payload.itens)) throw new Error("O campo edificacoes.itens deve ser uma lista.");
        if (payload.itens.length > MAX_ITEMS) {
            throw new Error(`O campo edificacoes.itens aceita no máximo ${MAX_ITEMS} edificações.`);
        }

        const buildings: CachedBuilding[] = [];
        for (const item of payload.itens) {
            const building = parseBuilding(item, utils);
            if (building) buildings.push(building);
        }

        return new ProvidedBuildings(buildings, area, payload.itens.length - buildings.length, polygon);
    }

    Around(latitude: number, longitude: number, rangeM: number): BuildingsAround | null {
        const edgeM = this.DistanceToEdgeM(latitude, longitude);
        if (edgeM <= 0) return null;

        const radiusM = Math.max(1, Math.min(rangeM, edgeM));
        const around = this.buildingUtils.AroundPoint(latitude, longitude, radiusM);
        const nearby = this.buildings.filter((building) => this.buildingUtils.Intersects(building.bbox, around));
        return { index: new BuildingIndex(nearby, latitude, longitude), radiusM, error: null };
    }

    DistanceToEdgeM(latitude: number, longitude: number): number {
        return this.polygon
            ? this.DistanceToPolygonEdgeM(this.polygon, latitude, longitude)
            : this.DistanceToBoxEdgeM(latitude, longitude);
    }

    private DistanceToPolygonEdgeM(ring: Ring, latitude: number, longitude: number): number {
        const lonScale = METERS_PER_DEGREE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
        const local = ring.map(([lon, lat]) => ({
            x: (lon - longitude) * lonScale,
            y: (lat - latitude) * METERS_PER_DEGREE,
        }));

        let inside = false;
        let nearest = Infinity;
        for (let i = 0, j = local.length - 1; i < local.length; j = i++) {
            const a = local[i]!;
            const b = local[j]!;
            if ((a.y > 0) !== (b.y > 0) && 0 < ((b.x - a.x) * (0 - a.y)) / (b.y - a.y) + a.x) inside = !inside;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lengthSquared = dx * dx + dy * dy;
            const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / lengthSquared));
            nearest = Math.min(nearest, Math.hypot(a.x + t * dx, a.y + t * dy));
        }
        return inside ? nearest : -nearest;
    }

    private DistanceToBoxEdgeM(latitude: number, longitude: number): number {
        const lonScale = METERS_PER_DEGREE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
        return Math.min(
            (latitude - this.area.minLatitude) * METERS_PER_DEGREE,
            (this.area.maxLatitude - latitude) * METERS_PER_DEGREE,
            (longitude - this.area.minLongitude) * lonScale,
            (this.area.maxLongitude - longitude) * lonScale,
        );
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function parseArea(value: unknown): BoundingBoxDTO {
    const invalid = new Error("O campo edificacoes.area deve ter minLatitude, maxLatitude, minLongitude e maxLongitude válidos.");
    if (!isObject(value)) throw invalid;
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } = value;
    if (
        !isCoordinate(minLatitude, -90, 90) || !isCoordinate(maxLatitude, -90, 90) ||
        !isCoordinate(minLongitude, -180, 180) || !isCoordinate(maxLongitude, -180, 180) ||
        minLatitude > maxLatitude || minLongitude > maxLongitude
    ) throw invalid;
    return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

function parsePolygon(value: unknown): Ring | null {
    if (value === undefined || value === null) return null;
    const ring = Array.isArray(value) && value.length >= 3 ? parseRing([...value, value[0]]) : null;
    if (!ring) throw new Error("O campo edificacoes.poligono deve ter ao menos 3 pontos [longitude, latitude] válidos.");
    return ring;
}

function parseRing(value: unknown): Ring | null {
    if (!Array.isArray(value) || value.length < 4) return null;
    const ring: Ring = [];
    for (const point of value) {
        if (!Array.isArray(point) || !isCoordinate(point[0], -180, 180) || !isCoordinate(point[1], -90, 90)) return null;
        ring.push([point[0], point[1]]);
    }
    return ring;
}

function parsePolygons(geometry: unknown): PolygonRings[] {
    if (!isObject(geometry) || !Array.isArray(geometry.coordinates)) return [];
    const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon" ? geometry.coordinates : [];

    const result: PolygonRings[] = [];
    for (const polygon of polygons) {
        if (!Array.isArray(polygon)) continue;
        const rings = polygon.map(parseRing);
        if (!rings[0]) continue;
        result.push(rings.filter((ring): ring is Ring => ring !== null));
    }
    return result;
}

function parseBuilding(item: unknown, utils: BuildingUtils): CachedBuilding | null {
    if (!isObject(item)) return null;
    const height = item.altura_m;
    if (typeof height !== "number" || !Number.isFinite(height) || height <= 0 || height > 1000) return null;
    if (typeof item.id !== "string" && typeof item.id !== "number") return null;

    const polygons = parsePolygons(item.geometria);
    if (polygons.length === 0) return null;

    const outer = polygons.flatMap((rings) => rings[0]!);
    const lons = outer.map(([lon]) => lon);
    const lats = outer.map(([, lat]) => lat);
    const bbox: BoundingBoxDTO = {
        minLatitude: Math.min(...lats),
        maxLatitude: Math.max(...lats),
        minLongitude: Math.min(...lons),
        maxLongitude: Math.max(...lons),
    };
    const material = utils.Material(typeof item.codigo_material === "string" ? item.codigo_material : "");

    return {
        id: String(item.id),
        fonte: "OVERTURE",
        fonte_original: null,
        versao_fonte: "FRONT",
        subtipo: null,
        classe: null,
        altura_m: height,
        origem_altura: "INFORMADA",
        pavimentos: null,
        largura_m: null,
        profundidade_m: null,
        area_m2: null,
        codigo_material: material.codigo,
        nome_material: material.nome,
        origem_material: "INFORMADO",
        material_fachada_original: null,
        latitude: (bbox.minLatitude + bbox.maxLatitude) / 2,
        longitude: (bbox.minLongitude + bbox.maxLongitude) / 2,
        polygons,
        bbox,
    };
}
