// SQL da aplicação. Cada consulta é exportada como uma variável.

// ---------------------------------------------------------------------------
// BuildingService
// ---------------------------------------------------------------------------

const buildingColumns = `
    e.id_edificacao,
    e.id_externo,
    e.fonte,
    e.fonte_original,
    e.versao_fonte,
    e.subtipo,
    e.classe,
    e.altura_m::float8 AS altura_m,
    e.origem_altura,
    e.pavimentos,
    e.largura_m::float8 AS largura_m,
    e.comprimento_m::float8 AS comprimento_m,
    e.area_m2::float8 AS area_m2,
    e.codigo_material,
    m.nome AS nome_material,
    e.origem_material,
    ST_Y(ST_PointOnSurface(e.geom)) AS latitude,
    ST_X(ST_PointOnSurface(e.geom)) AS longitude,
    ST_AsGeoJSON(e.geom, 7, 0)::jsonb AS geometria
`;

/** $1 minLatitude, $2 maxLatitude, $3 minLongitude, $4 maxLongitude, $5 frequência (MHz), $6 limite. */
export const listBuildingsQuery = `
    SELECT
        ${buildingColumns},
        ROUND(perda_material_db(e.codigo_material, $5)::numeric, 1)::float8 AS perda_material_db,
        COUNT(*) OVER()::int AS total
    FROM edificacoes e
    JOIN materiais_construcao m ON m.codigo = e.codigo_material
    WHERE e.geom && ST_MakeEnvelope($3, $1, $4, $2, 4674)
    ORDER BY e.id_edificacao
    LIMIT $6
`;

/** $1 id_edificacao, $2 frequência (MHz). */
export const findBuildingByIdQuery = `
    SELECT
        ${buildingColumns},
        ROUND(perda_material_db(e.codigo_material, $2)::numeric, 1)::float8 AS perda_material_db
    FROM edificacoes e
    JOIN materiais_construcao m ON m.codigo = e.codigo_material
    WHERE e.id_edificacao = $1
`;

/** Correção manual. $1 id_edificacao, $2 altura (ou null), $3 código do material (ou null). */
export const updateBuildingQuery = `
    UPDATE edificacoes SET
        altura_m = COALESCE($2, altura_m),
        origem_altura = CASE WHEN $2::numeric IS NULL THEN origem_altura ELSE 'MANUAL' END,
        codigo_material = COALESCE($3, codigo_material),
        origem_material = CASE WHEN $3::varchar IS NULL THEN origem_material ELSE 'MANUAL' END,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id_edificacao = $1
    RETURNING id_edificacao
`;

const buildingMaterialColumns = `
    codigo,
    nome,
    descricao,
    perda_db_900mhz::float8 AS perda_db_900mhz,
    perda_db_2400mhz::float8 AS perda_db_2400mhz,
    padrao
`;

export const listBuildingMaterialsQuery = `
    SELECT ${buildingMaterialColumns}
    FROM materiais_construcao
    ORDER BY padrao DESC, codigo
`;

/** $1 código do material. */
export const findBuildingMaterialQuery = `
    SELECT ${buildingMaterialColumns}
    FROM materiais_construcao
    WHERE codigo = $1
`;

/** $1 código do novo material padrão. */
export const unsetDefaultBuildingMaterialQuery = `
    UPDATE materiais_construcao SET padrao = FALSE
    WHERE padrao AND codigo <> $1
`;

/** $1 código, $2 perda a 900 MHz (ou null), $3 perda a 2400 MHz (ou null), $4 padrão (ou null). */
export const updateBuildingMaterialQuery = `
    UPDATE materiais_construcao SET
        perda_db_900mhz = COALESCE($2, perda_db_900mhz),
        perda_db_2400mhz = COALESCE($3, perda_db_2400mhz),
        padrao = CASE WHEN $4::boolean IS TRUE THEN TRUE ELSE padrao END,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE codigo = $1
    RETURNING ${buildingMaterialColumns}
`;

/** Edificações sem material identificado acompanham o material padrão. $1 código do padrão. */
export const applyDefaultBuildingMaterialQuery = `
    UPDATE edificacoes SET
        codigo_material = $1,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE origem_material = 'PADRAO'
      AND codigo_material <> $1
`;

/**
 * Edificações cruzadas pela linha reta de cada enlace (gateway → ponto).
 * $1 enlaces em JSON [{ id, origem_lat, origem_lng, origem_altura_m, destino_lat, destino_lng, destino_altura_m }],
 * $2 frequência (MHz).
 * `distancia_origem_m`: onde a linha entra na edificação; `trecho_m`: comprimento da linha dentro dela;
 * `altura_linha_m`: altura da linha de visada nesse ponto (sem relevo).
 */
export const findBuildingsOnLinksQuery = `
    WITH enlaces AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS e(
            id text,
            origem_lat float8,
            origem_lng float8,
            origem_altura_m float8,
            destino_lat float8,
            destino_lng float8,
            destino_altura_m float8
        )
    ),
    linhas AS (
        SELECT
            e.*,
            ST_SetSRID(
                ST_MakeLine(ST_MakePoint(e.origem_lng, e.origem_lat), ST_MakePoint(e.destino_lng, e.destino_lat)),
                4674
            ) AS linha
        FROM enlaces e
    ),
    cruzamentos AS (
        SELECT
            l.id,
            l.origem_altura_m,
            l.destino_altura_m,
            ST_Length(l.linha::geography) AS comprimento_enlace_m,
            ed.id_edificacao,
            ed.altura_m::float8 AS altura_m,
            ed.codigo_material,
            ST_LineLocatePoint(
                l.linha,
                ST_ClosestPoint(ST_Intersection(l.linha, ed.geom), ST_StartPoint(l.linha))
            ) AS fracao,
            ST_Length(ST_Intersection(l.linha, ed.geom)::geography) AS trecho_m
        FROM linhas l
        JOIN edificacoes ed ON ST_Intersects(l.linha, ed.geom)
    )
    SELECT
        c.id,
        c.id_edificacao,
        c.altura_m,
        c.codigo_material,
        c.fracao * c.comprimento_enlace_m AS distancia_origem_m,
        c.origem_altura_m + (c.destino_altura_m - c.origem_altura_m) * c.fracao AS altura_linha_m,
        c.trecho_m,
        c.comprimento_enlace_m,
        perda_material_db(c.codigo_material, $2) AS perda_material_db
    FROM cruzamentos c
    ORDER BY c.id, c.fracao
`;

/** Indica se há edificações carregadas perto de um ponto. $1 latitude, $2 longitude, $3 raio em graus. */
export const hasBuildingsNearQuery = `
    SELECT EXISTS (
        SELECT 1
        FROM edificacoes
        WHERE geom && ST_Expand(ST_SetSRID(ST_MakePoint($2, $1), 4674), $3)
    ) AS existe
`;

// ---------------------------------------------------------------------------
// PropagationService
// ---------------------------------------------------------------------------

/** $1 id_cenario_gateway, $2 mancha em GeoJSON, $3 parâmetros do cálculo em JSON. */
export const updateGatewayCoverageQuery = `
    UPDATE cenario_gateways SET
        mancha_cobertura = ST_SetSRID(ST_GeomFromGeoJSON($2), 4674),
        parametros_calculo = COALESCE(parametros_calculo, '{}'::jsonb) || $3::jsonb
    WHERE id_cenario_gateway = $1
`;

/** Une as manchas dos gateways do cenário e devolve a mancha consolidada em GeoJSON. $1 id_cenario. */
export const updateScenarioCoverageQuery = `
    UPDATE cenarios SET
        mancha_consolidada = (
            SELECT ST_Multi(ST_Union(cg.mancha_cobertura))
            FROM cenario_gateways cg
            WHERE cg.id_cenario = $1
              AND cg.mancha_cobertura IS NOT NULL
        ),
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id_cenario = $1
    RETURNING ST_AsGeoJSON(mancha_consolidada, 7, 0)::jsonb AS mancha_consolidada
`;

/** $1 id_cenario. */
export const findScenarioCoverageQuery = `
    SELECT ST_AsGeoJSON(mancha_consolidada, 7, 0)::jsonb AS mancha_consolidada
    FROM cenarios
    WHERE id_cenario = $1
`;

/** $1 id_cenario. */
export const findScenarioGatewaysCoverageQuery = `
    SELECT
        cg.id_cenario_gateway,
        cg.id_estudo_ponto,
        ep.rotulo,
        ep.latitude::float8 AS latitude,
        ep.longitude::float8 AS longitude,
        (cg.parametros_calculo ->> 'alcance_medio_m')::float8 AS alcance_medio_m,
        cg.parametros_calculo ->> 'modelo' AS modelo_propagacao,
        ST_AsGeoJSON(cg.mancha_cobertura, 7, 0)::jsonb AS mancha_cobertura
    FROM cenario_gateways cg
    JOIN estudo_pontos ep ON ep.id_estudo_ponto = cg.id_estudo_ponto
    WHERE cg.id_cenario = $1
    ORDER BY cg.id_cenario_gateway
`;

// ---------------------------------------------------------------------------
// BuildingService – importação das edificações da Overture Maps
// ---------------------------------------------------------------------------

export const getDefaultBuildingMaterialQuery = `
    SELECT codigo FROM materiais_construcao WHERE padrao LIMIT 1
`;

/**
 * Insere ou atualiza edificações. A geometria vem em WKB (hex); largura, comprimento e área são
 * calculados aqui, na zona UTM SIRGAS 2000 de cada edificação. Correções manuais são mantidas.
 * $1 edificações em JSON, $2 release da Overture, $3 lote de carga.
 */
export const upsertBuildingsQuery = `
    WITH dados AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS d(
            id text,
            fonte_original text,
            subtipo text,
            classe text,
            altura_m numeric,
            origem_altura text,
            pavimentos int,
            codigo_material text,
            origem_material text,
            material_fachada_original text,
            material_telhado_original text,
            wkb_hex text
        )
    ),
    geometrias AS (
        SELECT
            d.*,
            ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromWKB(decode(d.wkb_hex, 'hex')), 4674)), 3)) AS geom
        FROM dados d
    ),
    medidas AS (
        SELECT
            g.*,
            ST_ExteriorRing(ST_OrientedEnvelope(ST_Transform(
                g.geom,
                (CASE WHEN ST_Y(ST_Centroid(g.geom)) < 0 THEN 31960 ELSE 31954 END
                    + floor((ST_X(ST_Centroid(g.geom)) + 180) / 6) + 1)::int
            ))) AS anel
        FROM geometrias g
        WHERE NOT ST_IsEmpty(g.geom)
    ),
    lados AS (
        SELECT
            m.*,
            ST_Distance(ST_PointN(m.anel, 1), ST_PointN(m.anel, 2)) AS lado_a,
            ST_Distance(ST_PointN(m.anel, 2), ST_PointN(m.anel, 3)) AS lado_b
        FROM medidas m
    )
    INSERT INTO edificacoes (
        id_externo, fonte, fonte_original, versao_fonte, subtipo, classe,
        altura_m, origem_altura, pavimentos, largura_m, comprimento_m, area_m2,
        codigo_material, origem_material, material_fachada_original, material_telhado_original,
        geom, lote_carga
    )
    SELECT
        l.id, 'OVERTURE', l.fonte_original, $2, l.subtipo, l.classe,
        l.altura_m, l.origem_altura, l.pavimentos,
        ROUND(LEAST(l.lado_a, l.lado_b)::numeric, 2),
        ROUND(GREATEST(l.lado_a, l.lado_b)::numeric, 2),
        ROUND(ST_Area(l.geom::geography)::numeric, 2),
        l.codigo_material, l.origem_material, l.material_fachada_original, l.material_telhado_original,
        l.geom, $3
    FROM lados l
    ON CONFLICT (id_externo) DO UPDATE SET
        fonte_original = EXCLUDED.fonte_original,
        versao_fonte = EXCLUDED.versao_fonte,
        subtipo = EXCLUDED.subtipo,
        classe = EXCLUDED.classe,
        altura_m = CASE WHEN edificacoes.origem_altura = 'MANUAL' THEN edificacoes.altura_m ELSE EXCLUDED.altura_m END,
        origem_altura = CASE WHEN edificacoes.origem_altura = 'MANUAL' THEN 'MANUAL' ELSE EXCLUDED.origem_altura END,
        pavimentos = EXCLUDED.pavimentos,
        largura_m = EXCLUDED.largura_m,
        comprimento_m = EXCLUDED.comprimento_m,
        area_m2 = EXCLUDED.area_m2,
        codigo_material = CASE WHEN edificacoes.origem_material = 'MANUAL' THEN edificacoes.codigo_material ELSE EXCLUDED.codigo_material END,
        origem_material = CASE WHEN edificacoes.origem_material = 'MANUAL' THEN 'MANUAL' ELSE EXCLUDED.origem_material END,
        material_fachada_original = EXCLUDED.material_fachada_original,
        material_telhado_original = EXCLUDED.material_telhado_original,
        geom = EXCLUDED.geom,
        lote_carga = EXCLUDED.lote_carga,
        atualizado_em = CURRENT_TIMESTAMP
`;

/** Indica se a área já foi importada. $1 minLatitude, $2 maxLatitude, $3 minLongitude, $4 maxLongitude. */
export const isAreaImportedQuery = `
    SELECT COALESCE(ST_Covers(ST_Union(a.geom), ST_MakeEnvelope($3, $1, $4, $2, 4674)), FALSE) AS importada
    FROM areas_edificacoes_importadas a
    WHERE a.geom && ST_MakeEnvelope($3, $1, $4, $2, 4674)
`;

/** $1 minLatitude, $2 maxLatitude, $3 minLongitude, $4 maxLongitude, $5 release, $6 quantidade. */
export const insertImportedAreaQuery = `
    INSERT INTO areas_edificacoes_importadas (geom, versao_fonte, quantidade_edificacoes)
    VALUES (ST_MakeEnvelope($3, $1, $4, $2, 4674), $5, $6)
`;

/** Retângulo que envolve os pontos do estudo. $1 id_estudo. */
export const findStudyExtentQuery = `
    SELECT
        MIN(latitude)::float8 AS min_latitude,
        MAX(latitude)::float8 AS max_latitude,
        MIN(longitude)::float8 AS min_longitude,
        MAX(longitude)::float8 AS max_longitude
    FROM estudo_pontos
    WHERE id_estudo = $1
`;
