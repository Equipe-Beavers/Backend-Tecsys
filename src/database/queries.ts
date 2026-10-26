// SQL for installation criteria. Values are always supplied as parameters.
const criterionColumns = `id_criterio_instalacao, id_usuario, nome,
  tipos_elementos_permitidos, tipos_elementos_proibidos,
  distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
  relevo, criado_em, atualizado_em`;

export const createInstallCriterionQuery = `
  INSERT INTO criterios_instalacao (
    id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
    relevo
  ) SELECT id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
    relevo
  FROM jsonb_populate_record(NULL::criterios_instalacao, $1::jsonb)
  RETURNING ${criterionColumns}`;

export const listInstallCriteriaQuery = `
  SELECT ${criterionColumns} FROM criterios_instalacao
  WHERE ($1::bigint IS NULL OR id_usuario = $1::bigint)
  ORDER BY id_criterio_instalacao
  LIMIT $2 OFFSET $3`;

export const getInstallCriterionQuery = `
  SELECT ${criterionColumns} FROM criterios_instalacao
  WHERE id_criterio_instalacao = $1`;

export const updateInstallCriterionQuery = `
  UPDATE criterios_instalacao SET
    id_usuario = CASE WHEN $2::jsonb ? 'id_usuario' THEN ($2::jsonb->>'id_usuario')::bigint ELSE id_usuario END,
    nome = CASE WHEN $2::jsonb ? 'nome' THEN $2::jsonb->>'nome' ELSE nome END,
    tipos_elementos_permitidos = CASE WHEN $2::jsonb ? 'tipos_elementos_permitidos' THEN NULLIF($2::jsonb->'tipos_elementos_permitidos', 'null'::jsonb) ELSE tipos_elementos_permitidos END,
    tipos_elementos_proibidos = CASE WHEN $2::jsonb ? 'tipos_elementos_proibidos' THEN NULLIF($2::jsonb->'tipos_elementos_proibidos', 'null'::jsonb) ELSE tipos_elementos_proibidos END,
    distancia_minima_ativos_m = CASE WHEN $2::jsonb ? 'distancia_minima_ativos_m' THEN ($2::jsonb->>'distancia_minima_ativos_m')::numeric ELSE distancia_minima_ativos_m END,
    distancia_maxima_ativos_m = CASE WHEN $2::jsonb ? 'distancia_maxima_ativos_m' THEN ($2::jsonb->>'distancia_maxima_ativos_m')::numeric ELSE distancia_maxima_ativos_m END,
    limite_gateways = CASE WHEN $2::jsonb ? 'limite_gateways' THEN ($2::jsonb->>'limite_gateways')::integer ELSE limite_gateways END,
    relevo = CASE WHEN $2::jsonb ? 'relevo' THEN NULLIF($2::jsonb->'relevo', 'null'::jsonb) ELSE relevo END,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id_criterio_instalacao = $1
  RETURNING ${criterionColumns}`;

export const deleteInstallCriterionQuery = `
  DELETE FROM criterios_instalacao WHERE id_criterio_instalacao = $1
  RETURNING id_criterio_instalacao`;

export const listRFProfilesQuery = `
  SELECT id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, criado_em, atualizado_em
  FROM perfis_rf
  WHERE ($1::bigint IS NULL OR id_usuario = $1::bigint)
  ORDER BY id_perfil_rf
  LIMIT $2 OFFSET $3`;

export const getRFProfileQuery = `
  SELECT id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, criado_em, atualizado_em
  FROM perfis_rf
  WHERE id_perfil_rf = $1`;

export const createRFProfileQuery = `
  INSERT INTO perfis_rf (
    id_usuario, nome, frequencia_mhz, potencia_transmissao_dbm,
    sensibilidade_recepcao_dbm, altura_gateway_m, altura_dispositivo_m,
    capacidade_max_equipamentos, atenuacao_adicional_db
  ) SELECT id_usuario, nome, frequencia_mhz, potencia_transmissao_dbm,
    sensibilidade_recepcao_dbm, altura_gateway_m, altura_dispositivo_m,
    capacidade_max_equipamentos, atenuacao_adicional_db
  FROM jsonb_populate_record(NULL::perfis_rf, $1::jsonb)
  RETURNING id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, criado_em, atualizado_em`;

export const updateRFProfileQuery = `
  UPDATE perfis_rf SET
    nome = CASE WHEN $2::jsonb ? 'nome' THEN $2::jsonb->>'nome' ELSE nome END,
    frequencia_mhz = CASE WHEN $2::jsonb ? 'frequencia_mhz' THEN ($2::jsonb->>'frequencia_mhz')::numeric ELSE frequencia_mhz END,
    potencia_transmissao_dbm = CASE WHEN $2::jsonb ? 'potencia_transmissao_dbm' THEN ($2::jsonb->>'potencia_transmissao_dbm')::numeric ELSE potencia_transmissao_dbm END,
    sensibilidade_recepcao_dbm = CASE WHEN $2::jsonb ? 'sensibilidade_recepcao_dbm' THEN ($2::jsonb->>'sensibilidade_recepcao_dbm')::numeric ELSE sensibilidade_recepcao_dbm END,
    altura_gateway_m = CASE WHEN $2::jsonb ? 'altura_gateway_m' THEN ($2::jsonb->>'altura_gateway_m')::numeric ELSE altura_gateway_m END,
    altura_dispositivo_m = CASE WHEN $2::jsonb ? 'altura_dispositivo_m' THEN ($2::jsonb->>'altura_dispositivo_m')::numeric ELSE altura_dispositivo_m END,
    capacidade_max_equipamentos = CASE WHEN $2::jsonb ? 'capacidade_max_equipamentos' THEN ($2::jsonb->>'capacidade_max_equipamentos')::integer ELSE capacidade_max_equipamentos END,
    atenuacao_adicional_db = CASE WHEN $2::jsonb ? 'atenuacao_adicional_db' THEN ($2::jsonb->>'atenuacao_adicional_db')::numeric ELSE atenuacao_adicional_db END,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id_perfil_rf = $1
  RETURNING id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, criado_em, atualizado_em`;

export const deleteRFProfileQuery = `
  DELETE FROM perfis_rf
  WHERE id_perfil_rf = $1
  RETURNING id_perfil_rf`;

const studyColumns = `id_estudo, id_usuario, id_perfil_rf, id_criterio_instalacao,
  tipo_delimitacao, uf, municipio, bairro, ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geom,
  nome, descricao, distribuidora, versao_bdgd, nome_base_externa,
  tipos_ativo_selecionados, status, criado_em, atualizado_em`;

export const createStudyQuery = `
  INSERT INTO estudos (
    id_usuario, id_perfil_rf, id_criterio_instalacao, tipo_delimitacao,
    uf, municipio, bairro, geom, nome, descricao, distribuidora,
    versao_bdgd, nome_base_externa, tipos_ativo_selecionados, status
  ) SELECT
    ($1::jsonb->>'id_usuario')::bigint,
    profile.id_perfil_rf, criterion.id_criterio_instalacao,
    $1::jsonb->>'tipo_delimitacao',
    $1::jsonb->>'uf', $1::jsonb->>'municipio', $1::jsonb->>'bairro',
    CASE WHEN NULLIF($1::jsonb->'geom', 'null'::jsonb) IS NULL THEN NULL
      ELSE ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(($1::jsonb->'geom')::text), 4326), 4674) END,
    $1::jsonb->>'nome', $1::jsonb->>'descricao', $1::jsonb->>'distribuidora',
    $1::jsonb->>'versao_bdgd', $1::jsonb->>'nome_base_externa',
    NULLIF($1::jsonb->'tipos_ativo_selecionados', 'null'::jsonb),
    $1::jsonb->>'status'
  FROM perfis_rf AS profile
  JOIN criterios_instalacao AS criterion
    ON criterion.id_criterio_instalacao = ($1::jsonb->>'id_criterio_instalacao')::bigint
    AND criterion.id_usuario = ($1::jsonb->>'id_usuario')::bigint
  WHERE profile.id_perfil_rf = ($1::jsonb->>'id_perfil_rf')::bigint
    AND profile.id_usuario = ($1::jsonb->>'id_usuario')::bigint
  RETURNING ${studyColumns}`;

export const listStudiesQuery = `
  SELECT ${studyColumns},
    (SELECT profile.nome FROM perfis_rf AS profile
      WHERE profile.id_perfil_rf = estudos.id_perfil_rf) AS nome_perfil_rf,
    (SELECT criterion.nome FROM criterios_instalacao AS criterion
      WHERE criterion.id_criterio_instalacao = estudos.id_criterio_instalacao) AS nome_criterio_instalacao
  FROM estudos
  WHERE ($1::bigint IS NULL OR id_usuario = $1::bigint)
  ORDER BY id_estudo DESC`;

export const getStudyQuery = `
  SELECT ${studyColumns} FROM estudos WHERE id_estudo = $1`;

export const updateStudyQuery = `
  UPDATE estudos SET
    nome = CASE WHEN $2::jsonb ? 'nome' THEN $2::jsonb->>'nome' ELSE nome END,
    descricao = CASE WHEN $2::jsonb ? 'descricao' THEN $2::jsonb->>'descricao' ELSE descricao END,
    uf = CASE WHEN $2::jsonb ? 'uf' THEN $2::jsonb->>'uf' ELSE uf END,
    municipio = CASE WHEN $2::jsonb ? 'municipio' THEN $2::jsonb->>'municipio' ELSE municipio END,
    bairro = CASE WHEN $2::jsonb ? 'bairro' THEN $2::jsonb->>'bairro' ELSE bairro END,
    id_perfil_rf = CASE WHEN $2::jsonb ? 'id_perfil_rf' THEN ($2::jsonb->>'id_perfil_rf')::bigint ELSE id_perfil_rf END,
    id_criterio_instalacao = CASE WHEN $2::jsonb ? 'id_criterio_instalacao' THEN ($2::jsonb->>'id_criterio_instalacao')::bigint ELSE id_criterio_instalacao END,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id_estudo = $1
    AND EXISTS (
      SELECT 1 FROM perfis_rf AS profile
      WHERE profile.id_perfil_rf = COALESCE(($2::jsonb->>'id_perfil_rf')::bigint, estudos.id_perfil_rf)
        AND profile.id_usuario = estudos.id_usuario
    )
    AND EXISTS (
      SELECT 1 FROM criterios_instalacao AS criterion
      WHERE criterion.id_criterio_instalacao = COALESCE(($2::jsonb->>'id_criterio_instalacao')::bigint, estudos.id_criterio_instalacao)
        AND criterion.id_usuario = estudos.id_usuario
    )
  RETURNING ${studyColumns}`;

export const deleteStudyQuery = `
  DELETE FROM estudos WHERE id_estudo = $1 RETURNING id_estudo`;
export const lockInstallCriterionQuery = `SELECT tipos_elementos_permitidos, tipos_elementos_proibidos
  FROM criterios_instalacao WHERE id_criterio_instalacao = $1 FOR UPDATE`;
export const beginCriterionTransactionQuery = 'BEGIN';
export const commitCriterionTransactionQuery = 'COMMIT';
export const rollbackCriterionTransactionQuery = 'ROLLBACK';

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
