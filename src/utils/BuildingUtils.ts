import type { BoundingBoxDTO, HeightSource, MaterialSource } from "../interface/BuildingDTO.js";

const HEIGHT_PER_FLOOR_M = 3;
const DEFAULT_HEIGHT_M = 6;              // sem altura nem pavimentos: casa de 2 pavimentos
const DEFAULT_INDUSTRIAL_HEIGHT_M = 8;   // galpões
const CONCRETE_MIN_FLOORS = 4;           // a partir daqui o prédio é considerado concreto armado
const TILE_SIZE_DEGREES = 0.05;          // ~5,5 km

/** facade_material da Overture/OSM → código em materiais_construcao. */
const FACADE_MATERIALS: Record<string, string> = {
    brick: "ALVENARIA",
    cement_block: "ALVENARIA",
    clay: "ALVENARIA",
    plaster: "ALVENARIA",
    stone: "ALVENARIA",
    concrete: "CONCRETO",
    glass: "VIDRO",
    metal: "METAL",
    wood: "MADEIRA",
    timber_framing: "MADEIRA",
    plastic: "MADEIRA",
};

const METAL_SUBTYPES = new Set(["industrial"]);
const METAL_CLASSES = new Set(["warehouse", "hangar", "industrial", "manufacture", "factory", "carport", "roof"]);
const LIGHT_CLASSES = new Set(["hut", "cabin", "shed"]);

/** Regras de altura, material e divisão em áreas usadas na importação das edificações. */
export class BuildingUtils {
    Clean<T>(value: T | null | undefined): T | null {
        if (value === undefined || value === null) return null;
        if (typeof value === "number" && Number.isNaN(value)) return null;
        return value;
    }

    /** Altura informada → pavimentos × 3 m → padrão (6 m; galpão 8 m). */
    EstimateHeight(
        height: number | null,
        floors: number | null,
        subtype: string | null,
        buildingClass: string | null,
    ): { heightM: number; source: HeightSource; floors: number | null } {
        const cleanHeight = this.Clean(height);
        const cleanFloors = this.Clean(floors);
        let validFloors = cleanFloors && cleanFloors > 0 ? Math.trunc(cleanFloors) : null;

        if (cleanHeight && cleanHeight > 0) {
            validFloors ??= Math.max(1, Math.round(cleanHeight / HEIGHT_PER_FLOOR_M));
            return { heightM: Math.round(cleanHeight * 100) / 100, source: "INFORMADA", floors: validFloors };
        }
        if (validFloors) {
            return { heightM: validFloors * HEIGHT_PER_FLOOR_M, source: "PAVIMENTOS", floors: validFloors };
        }

        const industrial = METAL_SUBTYPES.has(subtype ?? "") || METAL_CLASSES.has(buildingClass ?? "");
        return { heightM: industrial ? DEFAULT_INDUSTRIAL_HEIGHT_M : DEFAULT_HEIGHT_M, source: "PADRAO", floors: null };
    }

    /**
     * Material informado pela fonte → regra (galpão = METAL, 4+ pavimentos = CONCRETO,
     * barraco/cabana = MADEIRA) → material padrão do banco (CONCRETO).
     */
    ClassifyMaterial(
        facade: string | null,
        subtype: string | null,
        buildingClass: string | null,
        floors: number | null,
        defaultMaterial: string,
    ): { code: string; source: MaterialSource } {
        const facadeCode = facade ? FACADE_MATERIALS[facade.toLowerCase()] : undefined;
        if (facadeCode) return { code: facadeCode, source: "INFORMADO" };
        if (METAL_SUBTYPES.has(subtype ?? "") || METAL_CLASSES.has(buildingClass ?? "")) return { code: "METAL", source: "REGRA" };
        if (floors && floors >= CONCRETE_MIN_FLOORS) return { code: "CONCRETO", source: "REGRA" };
        if (LIGHT_CLASSES.has(buildingClass ?? "")) return { code: "MADEIRA", source: "REGRA" };
        return { code: defaultMaterial, source: "PADRAO" };
    }

    /** Divide a área em quadrados de ~5,5 km para não carregar milhões de prédios de uma vez. */
    Tiles(area: BoundingBoxDTO, size = TILE_SIZE_DEGREES): BoundingBoxDTO[] {
        const columns = Math.max(1, Math.ceil((area.maxLongitude - area.minLongitude) / size - 1e-9));
        const rows = Math.max(1, Math.ceil((area.maxLatitude - area.minLatitude) / size - 1e-9));
        const stepLon = (area.maxLongitude - area.minLongitude) / columns;
        const stepLat = (area.maxLatitude - area.minLatitude) / rows;
        const tiles: BoundingBoxDTO[] = [];

        for (let c = 0; c < columns; c++) {
            for (let r = 0; r < rows; r++) {
                tiles.push({
                    minLongitude: area.minLongitude + c * stepLon,
                    maxLongitude: area.minLongitude + (c + 1) * stepLon,
                    minLatitude: area.minLatitude + r * stepLat,
                    maxLatitude: area.minLatitude + (r + 1) * stepLat,
                });
            }
        }
        return tiles;
    }
}
