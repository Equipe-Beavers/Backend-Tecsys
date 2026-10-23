import type {
    BoundingBoxDTO,
    BuildingMaterial,
    CachedBuilding,
    HeightSource,
    MaterialSource,
    OvertureBuildingRow,
} from "../interface/BuildingDTO.js";
import { GeometryUtils } from "./GeometryUtils.js";


export const HEIGHT_PER_FLOOR_M = 3;

export const DEFAULT_MATERIAL_CODE = "CONCRETO";


export const BUILDING_MATERIALS: BuildingMaterial[] = [
    { codigo: "CONCRETO", nome: "Concreto", descricao: "Estruturas, blocos e lajes de concreto. Material padrão quando a fonte não informa.", perda_db_900mhz: 12, perda_db_2400mhz: 17, padrao: true },
    { codigo: "ALVENARIA", nome: "Alvenaria", descricao: "Tijolo cerâmico, pedra ou reboco.", perda_db_900mhz: 7, perda_db_2400mhz: 10, padrao: false },
    { codigo: "METAL", nome: "Metálico", descricao: "Fachadas e coberturas metálicas.", perda_db_900mhz: 25, perda_db_2400mhz: 30, padrao: false },
    { codigo: "VIDRO", nome: "Vidro", descricao: "Fachadas de vidro comum.", perda_db_900mhz: 2, perda_db_2400mhz: 3, padrao: false },
    { codigo: "MADEIRA", nome: "Madeira / material leve", descricao: "Madeira, plástico e outras construções leves.", perda_db_900mhz: 3, perda_db_2400mhz: 5, padrao: false },
];

const FACADE_MATERIALS: Record<string, string> = {
    concrete: "CONCRETO",
    cement_block: "CONCRETO",
    brick: "ALVENARIA",
    clay: "ALVENARIA",
    plaster: "ALVENARIA",
    stone: "ALVENARIA",
    glass: "VIDRO",
    metal: "METAL",
    wood: "MADEIRA",
    timber_framing: "MADEIRA",
    plastic: "MADEIRA",
};

const MATERIALS_BY_CODE = new Map(BUILDING_MATERIALS.map((material) => [material.codigo, material]));

export class BuildingUtils {
    private geometryUtils = new GeometryUtils();

    Clean<T>(value: T | null | undefined): T | null {
        if (value === undefined || value === null) return null;
        if (typeof value === "number" && Number.isNaN(value)) return null;
        return value;
    }


    EstimateHeight(
        height: number | null,
        floors: number | null,
        defaultFloors: number,
    ): { heightM: number; source: HeightSource; floors: number | null } {
        const cleanHeight = this.Clean(height);
        const cleanFloors = this.Clean(floors);
        const validFloors = cleanFloors && cleanFloors > 0 ? Math.trunc(cleanFloors) : null;

        if (cleanHeight && cleanHeight > 0) {
            return { heightM: Math.round(cleanHeight * 100) / 100, source: "INFORMADA", floors: validFloors };
        }
        if (validFloors) {
            return { heightM: validFloors * HEIGHT_PER_FLOOR_M, source: "PAVIMENTOS", floors: validFloors };
        }
        return { heightM: defaultFloors * HEIGHT_PER_FLOOR_M, source: "PADRAO", floors: null };
    }


    ClassifyMaterial(facade: string | null): { code: string; source: MaterialSource } {
        const facadeCode = facade ? FACADE_MATERIALS[facade.trim().toLowerCase()] : undefined;
        if (facadeCode) return { code: facadeCode, source: "INFORMADO" };
        return { code: DEFAULT_MATERIAL_CODE, source: "PADRAO" };
    }

    Material(code: string): BuildingMaterial {
        return MATERIALS_BY_CODE.get(code) ?? MATERIALS_BY_CODE.get(DEFAULT_MATERIAL_CODE)!;
    }

    MaterialLossDb(code: string, frequencyMhz: number): number {
        const material = this.Material(code);
        const fraction = Math.log(Math.max(frequencyMhz, 1) / 900) / Math.log(2400 / 900);
        return Math.max(0, material.perda_db_900mhz + (material.perda_db_2400mhz - material.perda_db_900mhz) * fraction);
    }

    Normalize(row: OvertureBuildingRow, release: string, defaultFloors: number): CachedBuilding | null {
        const polygons = this.geometryUtils.ParseWkbPolygons(row.wkb_hex);
        if (polygons.length === 0) return null;

        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        for (const [lon, lat] of polygons.flatMap((rings) => rings[0]!)) {
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        }

        const projector = this.geometryUtils.Projector((minLat + maxLat) / 2, (minLon + maxLon) / 2);
        const local = polygons.map((rings) => rings.map((ring) => ring.map(([lon, lat]) => projector.toLocal(lon, lat))));
        const areaM2 = local.reduce(
            (sum, rings) => sum + rings.reduce((s, ring, i) => s + (i === 0 ? 1 : -1) * Math.abs(this.geometryUtils.SignedArea(ring)), 0),
            0,
        );
        if (areaM2 <= 0) return null;
        const { width, depth } = this.geometryUtils.MinimumRectangle(local.flatMap((rings) => rings[0]!));


        const largest = local.reduce((a, b) => (Math.abs(this.geometryUtils.SignedArea(b[0]!)) > Math.abs(this.geometryUtils.SignedArea(a[0]!)) ? b : a));
        const center = this.Centroid(largest[0]!);
        const centerGeo = projector.toGeo(center);

        const height = this.EstimateHeight(row.height, row.num_floors, defaultFloors);
        const material = this.ClassifyMaterial(row.facade_material);
        const round2 = (value: number) => Math.round(value * 100) / 100;

        return {
            id: row.id,
            fonte: "OVERTURE",
            fonte_original: row.fonte_original,
            versao_fonte: release,
            subtipo: row.subtype,
            classe: row.class,
            altura_m: height.heightM,
            origem_altura: height.source,
            pavimentos: height.floors,
            largura_m: width > 0 ? round2(width) : null,
            profundidade_m: depth > 0 ? round2(depth) : null,
            area_m2: round2(areaM2),
            codigo_material: material.code,
            nome_material: this.Material(material.code).nome,
            origem_material: material.source,
            material_fachada_original: row.facade_material,
            latitude: Math.round(centerGeo.latitude * 1e7) / 1e7,
            longitude: Math.round(centerGeo.longitude * 1e7) / 1e7,
            polygons,
            bbox: { minLatitude: minLat, maxLatitude: maxLat, minLongitude: minLon, maxLongitude: maxLon },
        };
    }

    Centroid(ring: { x: number; y: number }[]) {
        const area = this.geometryUtils.SignedArea(ring);
        if (Math.abs(area) < 1e-9) {
            const n = ring.length;
            return { x: ring.reduce((s, p) => s + p.x, 0) / n, y: ring.reduce((s, p) => s + p.y, 0) / n };
        }
        let cx = 0, cy = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const f = ring[j]!.x * ring[i]!.y - ring[i]!.x * ring[j]!.y;
            cx += (ring[j]!.x + ring[i]!.x) * f;
            cy += (ring[j]!.y + ring[i]!.y) * f;
        }
        return { x: cx / (6 * area), y: cy / (6 * area) };
    }

    TileKeys(area: BoundingBoxDTO, size: number): string[] {
        const keys: string[] = [];
        for (let col = Math.floor(area.minLongitude / size); col <= Math.floor(area.maxLongitude / size); col++) {
            for (let row = Math.floor(area.minLatitude / size); row <= Math.floor(area.maxLatitude / size); row++) {
                keys.push(`${col}:${row}`);
            }
        }
        return keys;
    }

    TileBounds(key: string, size: number): BoundingBoxDTO {
        const [col, row] = key.split(":").map(Number) as [number, number];
        return {
            minLongitude: col * size,
            maxLongitude: (col + 1) * size,
            minLatitude: row * size,
            maxLatitude: (row + 1) * size,
        };
    }

    Intersects(a: BoundingBoxDTO, b: BoundingBoxDTO): boolean {
        return a.minLongitude <= b.maxLongitude && a.maxLongitude >= b.minLongitude
            && a.minLatitude <= b.maxLatitude && a.maxLatitude >= b.minLatitude;
    }
    AroundPoint(latitude: number, longitude: number, radiusM: number): BoundingBoxDTO {
        const dLat = radiusM / 111320;
        const dLon = radiusM / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
        return {
            minLatitude: latitude - dLat,
            maxLatitude: latitude + dLat,
            minLongitude: longitude - dLon,
            maxLongitude: longitude + dLon,
        };
    }
}
