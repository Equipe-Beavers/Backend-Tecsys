export type HeightSource =
    | "INFORMADA"
    | "PAVIMENTOS"
    | "PADRAO"
    | "MANUAL";

export type MaterialSource =
    | "INFORMADO"
    | "REGRA"
    | "PADRAO"
    | "MANUAL";

/** Edificação como sai da tabela `edificacoes` (nomes das colunas do banco). */
export interface Building {
    id_edificacao: number;
    id_externo: string;
    fonte: string;
    fonte_original: string | null;
    versao_fonte: string | null;
    subtipo: string | null;
    classe: string | null;
    altura_m: number;
    origem_altura: HeightSource;
    pavimentos: number | null;
    largura_m: number | null;
    comprimento_m: number | null;
    area_m2: number | null;
    codigo_material: string;
    nome_material: string;
    origem_material: MaterialSource;
    perda_material_db: number;
    latitude: number;
    longitude: number;
    geometria: Record<string, unknown>;
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

export interface UpdateBuildingDTO {
    altura_m?: number;
    codigo_material?: string;
}

/** Material como sai da tabela `materiais_construcao`. */
export interface BuildingMaterial {
    codigo: string;
    nome: string;
    descricao: string | null;
    perda_db_900mhz: number;
    perda_db_2400mhz: number;
    padrao: boolean;
}

export interface UpdateBuildingMaterialDTO {
    perda_db_900mhz?: number;
    perda_db_2400mhz?: number;
    padrao?: boolean;
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

/** Linha devolvida por `findBuildingsOnLinksQuery`. */
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
    id_building: number;
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

export interface ImportBuildingsDTO extends BoundingBoxDTO {
    force?: boolean;
}

export interface ImportBuildingsResult {
    versao_fonte: string;
    areas_processadas: number;
    edificacoes_importadas: number;
    ja_importada: boolean;
}
