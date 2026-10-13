import type { QueryResultRow } from "pg";

export const assetTypes = [
    "POSTE",
    "TRANSFORMADOR",
    "SUBESTACAO",
    "DISPOSITIVO",
    "CHAVE_FUSIVEL",
    "CHAVE_SECCIONADORA",
    "RELIGADOR",
    "SECCIONADOR_AUTOMATICO",
    "REGULADOR_TENSAO",
    "BANCO_CAPACITORES",
] as const;

export type AssetType = (typeof assetTypes)[number];

export type Distributor = string;

export interface AssetFilters {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    types?: AssetType[];
    deviceTypeIds?: number[];
    distributors?: Distributor[];
    municipio?: string;
    bairro?: string;
    limit?: number;
}

export interface Asset {
    id: string;
    codId: string | null;
    tipo: AssetType;
    latitude: number;
    longitude: number;
    municipio: string | null;
    bairro: string | null;
    distribuidora: string | null;
    tipoDispositivoId: number | null;
    tipoDispositivoNome: string | null;
    tipoDispositivoCategoria: string | null;
    atributos: Record<string, unknown>;
}

export interface AssetsPage {
    items: Asset[];
    total: number;
}

export interface DeviceTypeSummary {
    id: number;
    nome: string;
    categoria: string | null;
}

export interface DistributorSummary {
    nome: string;
    latitude: number;
    longitude: number;
    totalAtivos: number;
}

export interface AssetRow extends QueryResultRow {
    id: string;
    id_ativo: number;
    cod_id: string | null;
    tipo: AssetType;
    latitude: number;
    longitude: number;
    municipio: string | null;
    bairro: string | null;
    distribuidora: string | null;
    tipo_dispositivo_id: number | null;
    tipo_dispositivo_nome: string | null;
    tipo_dispositivo_categoria: string | null;
    atributos: Record<string, unknown>;
    total?: number;
}