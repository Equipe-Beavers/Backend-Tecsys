import type { AssetFilters, AssetType } from "../../modules/repository/ActiveRepository.js";

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
            CONCAT(
                a.tipo_ativo,
                ':',
                COALESCE(a.cod_id, a.id_ativo::text)
            ) AS id,
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
        LEFT JOIN municipios m
            ON m.codigo_ibge::text = a.municipio
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
        id_ativo,
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

export function findAssetsQuery(filters: AssetFilters) {
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
    let rawConditions = "";
    let municipioJoin = "";

    if (filters.distributors && filters.distributors.length > 0) {
        values.push(filters.distributors);

        const param = `$${values.length}`;

        distributorCondition = ` AND distribuidora = ANY(${param}::text[])`;

        conditions.push(
            `distribuidora = ANY(${param}::text[])`
        );
    }

    const municipio = filters.municipio?.trim();

    if (municipio) {
        values.push(municipio);

        const param = `$${values.length}`;

        municipioJoin = `
            LEFT JOIN municipios m
                ON m.codigo_ibge::text = a.municipio
        `;

        rawConditions += `
            AND COALESCE(m.nome, a.municipio) = ${param}
        `;

        conditions.push(`municipio = ${param}`);
    }

    const bairro = filters.bairro?.trim();

    if (bairro) {
        values.push(bairro);

        const param = `$${values.length}`;

        rawConditions += ` AND a.bairro = ${param}`;

        conditions.push(`bairro = ${param}`);
    }

    if (filters.types && filters.types.length > 0) {
        values.push(filters.types);

        const param = `$${values.length}`;

        keyConditions += `
            AND tipo = ANY(${param}::text[])
        `;

        conditions.push(
            `tipo = ANY(${param}::text[])`
        );
    }

    if (filters.deviceTypeIds && filters.deviceTypeIds.length > 0) {
        values.push(filters.deviceTypeIds);

        const param = `$${values.length}`;

        keyConditions += `
            AND tip_id = ANY(${param}::integer[])
        `;

        conditions.push(
            `tipo_dispositivo_id = ANY(${param}::integer[])`
        );
    }

    const limit = filters.limit ?? 500;

    const quotaTypes: AssetType[] =
        filters.types && filters.types.length > 0
            ? [...filters.types]
            : [
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
            ];

    const perType = Math.max(
        1,
        Math.floor(limit / quotaTypes.length)
    );

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
            `(SELECT id_ativo
              FROM keys
              WHERE tipo = ${quotaParams[index]}
              ORDER BY id_ativo
              LIMIT ${perTypeParam})`
    );

    const text = `
        WITH keys AS MATERIALIZED (
            SELECT
                id_ativo,
                tipo,
                tip_id
            FROM (
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
                    ${municipioJoin}
                    WHERE a.registro_atual = TRUE
                      AND a.latitude BETWEEN $1 AND $2
                      AND a.longitude BETWEEN $3 AND $4
                      ${distributorCondition}
                      ${rawConditions}
                ) raw
            ) typed
            WHERE TRUE
                ${keyConditions}
        ),
        tops AS (
            ${branches.join("\n            UNION ALL\n            ")}
        )
        SELECT
            pagina.*,
            (SELECT COUNT(*)::int FROM keys) AS total
        FROM (
            ${assetSelect}
            WHERE ${conditions.join(" AND ")}
              AND id_ativo IN (
                  SELECT id_ativo
                  FROM tops
              )
            ORDER BY tipo, id
            LIMIT ${limitParam}
        ) pagina
    `;

    return {
        text,
        values,
    };
}

export const findDeviceTypesQuery = `
    SELECT
        id_tipo_dispositivo AS id,
        nome_dispositivo AS nome,
        categoria
    FROM tipos_dispositivos
    ORDER BY id_tipo_dispositivo
`;

export const findDistributorsQuery = `
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
`;

export function findAssetByIdQuery(id: string) {
    return {
        text: `
            ${assetSelect}
            WHERE (id = $1 OR cod_id = $1)
            LIMIT 1
        `,
        values: [id],
    };
}