import type { GeoJsonMultiPolygon, PolygonRings } from "../utils/GeometryUtils.js";


export type HeightSource =
    | "INFORMADA"
    | "PAVIMENTOS"
    | "PADRAO";


export type MaterialSource =
    | "INFORMADO"
    | "PADRAO";


export interface Building {
    id: string;
    fonte: "OVERTURE";
    fonte_original: string | null;
    versao_fonte: string;
    subtipo: string | null;
    classe: string | null;
    altura_m: number;
    origem_altura: HeightSource;
    pavimentos: number | null;
    largura_m: number | null;
    profundidade_m: number | null;
    area_m2: number | null;
    codigo_material: string;
    nome_material: string;
    origem_material: MaterialSource;
    material_fachada_original: string | null;
    perda_material_db: number;
    latitude: number;
    longitude: number;
    geometria: GeoJsonMultiPolygon;
}


export interface CachedBuilding extends Omit<Building, "perda_material_db" | "geometria"> {
    polygons: PolygonRings[];
    bbox: BoundingBoxDTO;
}

export interface OvertureBuildingRow {
    id: string;
    wkb_hex: string;
    subtype: string | null;
    class: string | null;
    height: number | null;
    num_floors: number | null;
    facade_material: string | null;
    fonte_original: string | null;
}

export interface ListBuildingsDTO {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    limit?: number;
    frequencyMhz?: number;
    format?: "json" | "geojson";
}

export interface ListBuildingsResult {
    data: Building[];
    total: number;
    fonte: string;
    versao_fonte: string;
}


export interface BuildingMaterial {
    codigo: string;
    nome: string;
    descricao: string;
    perda_db_900mhz: number;
    perda_db_2400mhz: number;
    padrao: boolean;
}

export interface LinkPointDTO {
    latitude: number;
    longitude: number;
    height_m: number;
}

export interface LinkDTO {
    id: string;
    origin: LinkPointDTO;
    destination: LinkPointDTO;
}

export interface CalculateObstructionDTO {
    frequency_mhz: number;
    max_loss_db?: number;
    links: LinkDTO[];
}


export interface BuildingOnLinkRow {
    id: string;
    id_edificacao: string;
    altura_m: number;
    codigo_material: string;
    distancia_origem_m: number;
    altura_linha_m: number;
    trecho_m: number;
    comprimento_enlace_m: number;
    perda_material_db: number;
}

export interface BuildingOnLink {
    id_building: string;
    height_m: number;
    line_height_m: number;
    distance_from_origin_m: number;
    material_code: string;
    blocks: boolean;
    loss_db: number;
}

export interface LinkObstruction {
    id: string;
    buildings_count: number;
    blocking_count: number;
    total_loss_db: number;
    buildings: BuildingOnLink[];
}

export interface BoundingBoxDTO {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
}
