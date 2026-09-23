import type { QueryResultRow } from "pg";
import { pool } from "../../database/pool.js";

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

function tipUnidExpression(alias: string): string {
    return `CASE
        WHEN ${alias}.atributos->>'tip_unid' ~ '^[0-9]+$'
        THEN (${alias}.atributos->>'tip_unid')::integer
        ELSE NULL
    END`;
}

function tipoExpression(tipoAtivo: string, tipId: string): string {
    return `CASE
        WHEN ${tipoAtivo} <> 'DISPOSITIVO' THEN ${tipoAtivo}
        WHEN ${tipId} BETWEEN 22 AND 27
            THEN 'CHAVE_FUSIVEL'
        WHEN ${tipId} IN (19, 20, 21, 28, 29, 30, 31, 33, 34)
            THEN 'CHAVE_SECCIONADORA'
        WHEN ${tipId} = 32
            THEN 'RELIGADOR'
        WHEN ${tipId} IN (35, 36)
            THEN 'SECCIONADOR_AUTOMATICO'
        WHEN ${tipId} BETWEEN 9 AND 12
            THEN 'BANCO_CAPACITORES'
        WHEN ${tipId} IN (13, 14)
            THEN 'REGULADOR_TENSAO'
        WHEN ${tipId} BETWEEN 37 AND 43
            THEN 'TRANSFORMADOR'
        ELSE 'DISPOSITIVO'
    END`;
}

const assetSelect = `
    WITH base AS (
        SELECT
            CONCAT(a.tipo_ativo, ':', COALESCE(a.cod_id, a.id_ativo::text)) AS id,
            a.id_ativo,
            a.cod_id,
            a.tipo_ativo,
            ${tipUnidExpression("a")} AS tip_id,
            a.latitude,
            a.longitude,
            COALESCE(m.nome, a.municipio) AS municipio,
            a.bairro,
            a.distribuidora,
            a.atributos
        FROM ativos_rede a
        LEFT JOIN municipios_ibge m
          ON m.codigo = a.municipio
        WHERE a.registro_atual = TRUE
    ),
    ativos AS (
        SELECT
            b.id,
            b.id_ativo,
            b.cod_id,
            ${tipoExpression("b.tipo_ativo", "b.tip_id")} AS tipo,
            b.latitude,
            b.longitude,
            b.municipio,
            b.bairro,
            b.distribuidora,
            b.tip_id AS tipo_dispositivo_id,
            td.nome_dispositivo AS tipo_dispositivo_nome,
            td.categoria AS tipo_dispositivo_categoria,
            CASE
                WHEN td.nome_dispositivo IS NULL THEN b.atributos
                ELSE b.atributos || jsonb_build_object(
                    'tipo_dispositivo_nome', td.nome_dispositivo,
                    'tipo_dispositivo_categoria', td.categoria
                )
            END AS atributos
        FROM base b
        LEFT JOIN tipos_dispositivos td
          ON td.id_tipo_dispositivo = b.tip_id
    )
    SELECT
        id,
        cod_id,
        tipo,
        latitude,
        longitude,
        municipio,
        bairro,
        distribuidora,
        tipo_dispositivo_id,
        tipo_dispositivo_nome,
        tipo_dispositivo_categoria,
        atributos
    FROM ativos
`;

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
    const values: unknown[] = [
        filters.minLatitude,
        filters.maxLatitude,
        filters.minLongitude,
        filters.maxLongitude,
    ];
    const conditions = [
        `latitude BETWEEN $1 AND $2`,
        `longitude BETWEEN $3 AND $4`,
    ];
    let distributorCondition = "";
    let keyConditions = "";

    if (filters.distributors && filters.distributors.length > 0) {
        values.push(filters.distributors);
        const param = `$${values.length}`;
        distributorCondition = ` AND distribuidora = ANY(${param}::text[])`;
        conditions.push(`distribuidora = ANY(${param}::text[])`);
    }

    if (filters.types && filters.types.length > 0) {
        values.push(filters.types);
        const param = `$${values.length}`;
        keyConditions += ` AND tipo = ANY(${param}::text[])`;
        conditions.push(`tipo = ANY(${param}::text[])`);
    }

    if (filters.deviceTypeIds && filters.deviceTypeIds.length > 0) {
        values.push(filters.deviceTypeIds);
        const param = `$${values.length}`;
        keyConditions += ` AND tip_id = ANY(${param}::integer[])`;
        conditions.push(`tipo_dispositivo_id = ANY(${param}::integer[])`);
    }

    const limit = filters.limit ?? 500;
    const quotaTypes: AssetType[] =
        filters.types && filters.types.length > 0
            ? [...filters.types]
            : [...assetTypes];
    const perType = Math.max(1, Math.floor(limit / quotaTypes.length));

    const quotaParams = quotaTypes.map((tipo) => {
        values.push(tipo);
        return `$${values.length}`;
    });

    values.push(perType);
    const perTypeParam = `$${values.length}`;
    values.push(limit);
    const limitParam = `$${values.length}`;

    const branches = quotaTypes.map(
        (_tipo, index) =>
            `(SELECT id_ativo FROM keys WHERE tipo = ${quotaParams[index]} ORDER BY id_ativo LIMIT ${perTypeParam})`,
    );

    const sql = `
        WITH keys AS MATERIALIZED (
            SELECT id_ativo, tipo, tip_id FROM (
                SELECT
                    id_ativo,
                    tip_id,
                    ${tipoExpression("tipo_ativo", "tip_id")} AS tipo
                FROM (
                    SELECT
                        a.id_ativo,
                        a.tipo_ativo,
                        ${tipUnidExpression("a")} AS tip_id
                    FROM ativos_rede a
                    WHERE a.registro_atual = TRUE
                      AND a.latitude BETWEEN $1 AND $2
                      AND a.longitude BETWEEN $3 AND $4${distributorCondition}
                ) raw
            ) typed
            WHERE TRUE${keyConditions}
        ),
        tops AS (
            ${branches.join("\n            UNION ALL\n            ")}
        )
        SELECT pagina.*, totals.total FROM (
            ${assetSelect}
            WHERE ${conditions.join(" AND ")}
              AND id_ativo IN (SELECT id_ativo FROM tops)
            ORDER BY tipo, id
            LIMIT ${limitParam}
        ) pagina
        CROSS JOIN (SELECT COUNT(*)::int AS total FROM keys) totals
    `;

    const result = await pool.query<AssetRow>(sql, values);
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
    }>(`
        SELECT
            id_tipo_dispositivo AS id,
            nome_dispositivo AS nome,
            categoria
        FROM tipos_dispositivos
        ORDER BY id_tipo_dispositivo
    `);

    return result.rows;
}

export async function findDistributors(): Promise<DistributorSummary[]> {
    const result = await pool.query<{
        nome: string;
        latitude: number;
        longitude: number;
        total_ativos: string;
    }>(`
        SELECT
            distribuidora AS nome,
            AVG(latitude) AS latitude,
            AVG(longitude) AS longitude,
            COUNT(*) AS total_ativos
        FROM ativos_rede
        WHERE registro_atual = TRUE
          AND distribuidora IS NOT NULL
          AND distribuidora <> ''
        GROUP BY distribuidora
        ORDER BY distribuidora
    `);

    return result.rows.map((row) => ({
        nome: row.nome,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        totalAtivos: Number(row.total_ativos),
    }));
}

export async function findAssetById(id: string): Promise<Asset | null> {
    const result = await pool.query<AssetRow>(
        `${assetSelect} WHERE (id = $1 OR cod_id = $1) LIMIT 1`,
        [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
}
