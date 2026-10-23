import type { QueryResultRow } from "pg";
import { pool } from "../../database/pool.js";
import { findAssetsQuery, findAssetByIdQuery, findDeviceTypesQuery, findDistributorsQuery } from "../../database/queries/ativo_queries.js";

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

interface AssetRow extends QueryResultRow {
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

function mapRow(row: AssetRow): Asset {
    return {
        id: row.id,
        codId: row.cod_id,
        tipo: row.tipo,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        municipio: row.municipio,
        bairro: row.bairro,
        distribuidora: row.distribuidora,
        tipoDispositivoId: row.tipo_dispositivo_id,
        tipoDispositivoNome: row.tipo_dispositivo_nome,
        tipoDispositivoCategoria: row.tipo_dispositivo_categoria,
        atributos: row.atributos,
    };
}

export async function findAssets(filters: AssetFilters): Promise<AssetsPage> {
    const { text, values } = findAssetsQuery(filters);
    const result = await pool.query<AssetRow>(
        text,
        values
    );

    return {
        items: result.rows.map(mapRow),
        total: result.rows[0]?.total ?? 0,
    };
}

export async function findDeviceTypes(): Promise<DeviceTypeSummary[]> {
    const result = await pool.query<{
        id: number;
        nome: string;
        categoria: string | null;
    }>(findDeviceTypesQuery);
    return result.rows;
}

export async function findDistributors(): Promise<DistributorSummary[]> {
    const result = await pool.query<{
        nome: string;
        latitude: number;
        longitude: number;
        total_ativos: string;
    }>(findDistributorsQuery);

    return result.rows.map((row) => ({
        nome: row.nome,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        totalAtivos: Number(row.total_ativos),
    }));
}

export async function findAssetById(
    id: string
): Promise<Asset | null> {
    const { text, values } = findAssetByIdQuery(id);
    const result = await pool.query<AssetRow>(
        text,
        values
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
}