import type { AssetFilters, AssetType } from "../../interface/active-repository.js";

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

const assetCte = `
    WITH base AS (
        SELECT
            'POSTE'::text AS tipo_ativo,
            a.id_poste AS id_ativo,
            a.cod_id,
            NULL::integer AS tip_id,
            pos.municipio,
            pos.bairro,
            pos.latitude,
            pos.longitude,
            pos.id_distribuidora,
            pos.registro_atual,
            jsonb_build_object(
                'altura', a.altura,
                'material', a.material,
                'esforco', a.esforco
            ) AS atributos
        FROM POSTES a
        JOIN POSICOES_GEOGRAFICAS pos
            ON pos.id_posicao = a.id_posicao
        WHERE a.registro_atual = TRUE
          AND pos.registro_atual = TRUE
          AND pos.latitude BETWEEN $2 AND $4
          AND pos.longitude BETWEEN $1 AND $3

        UNION ALL

        SELECT
            'SUBESTACAO'::text AS tipo_ativo,
            a.id_subestacao AS id_ativo,
            a.cod_id,
            NULL::integer AS tip_id,
            pos.municipio,
            pos.bairro,
            pos.latitude,
            pos.longitude,
            pos.id_distribuidora,
            pos.registro_atual,
            jsonb_build_object('nome', a.nome) AS atributos
        FROM SUBESTACOES a
        JOIN POSICOES_GEOGRAFICAS pos
            ON pos.id_posicao = a.id_posicao
        WHERE a.registro_atual = TRUE
          AND pos.registro_atual = TRUE
          AND pos.latitude BETWEEN $2 AND $4
          AND pos.longitude BETWEEN $1 AND $3

        UNION ALL

        SELECT
            'DISPOSITIVO'::text AS tipo_ativo,
            a.id_dispositivo AS id_ativo,
            a.cod_id,
            a.id_tipo_dispositivo AS tip_id,
            pos.municipio,
            pos.bairro,
            pos.latitude,
            pos.longitude,
            pos.id_distribuidora,
            pos.registro_atual,
            jsonb_build_object(
                'subestacao', a.subestacao,
                'codigo_conjunto_aneel', a.codigo_conjunto_aneel
            ) AS atributos
        FROM DISPOSITIVOS a
        JOIN POSICOES_GEOGRAFICAS pos
            ON pos.id_posicao = a.id_posicao
        WHERE a.registro_atual = TRUE
          AND pos.registro_atual = TRUE
          AND pos.latitude BETWEEN $2 AND $4
          AND pos.longitude BETWEEN $1 AND $3
    ),
    ativos AS (
        SELECT
            CONCAT(
                b.tipo_ativo,
                ':',
                COALESCE(b.cod_id, b.id_ativo::text)
            ) AS id,
            b.id_ativo,
            b.cod_id,
            ${tipoExpression("b.tipo_ativo", "b.tip_id")} AS tipo,
            b.latitude,
            b.longitude,
            COALESCE(m.nome, b.municipio) AS municipio,
            b.bairro,
            d.nome AS distribuidora,
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
        LEFT JOIN municipios m
            ON m.codigo_ibge::text = b.municipio
        LEFT JOIN distribuidoras d
            ON d.id = b.id_distribuidora
        LEFT JOIN tipos_dispositivos td
            ON td.id_tipo_dispositivo = b.tip_id
    )
`;

export function findAssetsQuery(filters: AssetFilters) {
    const values: unknown[] = [
        filters.minLongitude,
        filters.minLatitude,
        filters.maxLongitude,
        filters.maxLatitude,
    ];

    const conditions = [
        `latitude BETWEEN $2 AND $4`,
        `longitude BETWEEN $1 AND $3`,
    ];

    if (filters.distributors && filters.distributors.length > 0) {
        values.push(filters.distributors);
        conditions.push(`distribuidora = ANY($${values.length}::text[])`);
    }

    const municipio = filters.municipio?.trim();
    if (municipio) {
        values.push(municipio);
        conditions.push(`municipio = $${values.length}`);
    }

    const bairro = filters.bairro?.trim();
    if (bairro) {
        values.push(bairro);
        conditions.push(`bairro = $${values.length}`);
    }

    if (filters.types && filters.types.length > 0) {
        values.push(filters.types);
        conditions.push(`tipo = ANY($${values.length}::text[])`);
    }

    if (filters.deviceTypeIds && filters.deviceTypeIds.length > 0) {
        values.push(filters.deviceTypeIds);
        conditions.push(
            `tipo_dispositivo_id = ANY($${values.length}::integer[])`,
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
        ${assetCte},
        filtrados AS MATERIALIZED (
            SELECT *
            FROM ativos
            WHERE ${conditions.join(" AND ")}
        ),
        keys AS (
            SELECT id_ativo, tipo
            FROM filtrados
        ),
        tops AS (
            ${branches.join("\n            UNION ALL\n            ")}
        )
        SELECT
            filtrados.*,
            (SELECT COUNT(*)::int FROM keys) AS total
        FROM filtrados
        WHERE id_ativo IN (
            SELECT id_ativo
            FROM tops
        )
        ORDER BY tipo, id
        LIMIT ${limitParam}
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
        d.nome,
        AVG(pos.latitude) AS latitude,
        AVG(pos.longitude) AS longitude,
        COUNT(*)::int AS total_ativos
    FROM posicoes_geograficas pos
    JOIN distribuidoras d
        ON d.id = pos.id_distribuidora
    WHERE pos.registro_atual = TRUE
      AND pos.tipo_posicao IN ('POSTE', 'SUBESTACAO', 'DISPOSITIVO')
    GROUP BY d.id, d.nome
    ORDER BY d.nome
`;

export function findAssetByIdQuery(id: string) {
    return {
        text: `
            ${assetCte}
            SELECT *
            FROM ativos
            WHERE (id = $1 OR cod_id = $1)
            LIMIT 1
        `,
        values: [id],
    };
}