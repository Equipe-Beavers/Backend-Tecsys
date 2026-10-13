// SQL da aplicação. Cada consulta é exportada como uma variável.

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
