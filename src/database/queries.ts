// SQL for installation criteria. Values are always supplied as parameters.
const criterionColumns = `id_criterio_instalacao, id_usuario, nome,
  tipos_elementos_permitidos, tipos_elementos_proibidos,
  requer_alimentacao_eletrica, distancia_maxima_ativos_m, limite_gateways,
  relevo, vegetacoes, edificacoes, antenas, criado_em, atualizado_em`;

export const createInstallCriterionQuery = `
  INSERT INTO criterios_instalacao (
    id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_maxima_ativos_m, limite_gateways,
    relevo, vegetacoes, edificacoes, antenas
  ) SELECT id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_maxima_ativos_m, limite_gateways,
    relevo, vegetacoes, edificacoes, antenas
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
    requer_alimentacao_eletrica = CASE WHEN $2::jsonb ? 'requer_alimentacao_eletrica' THEN ($2::jsonb->>'requer_alimentacao_eletrica')::boolean ELSE requer_alimentacao_eletrica END,
    distancia_maxima_ativos_m = CASE WHEN $2::jsonb ? 'distancia_maxima_ativos_m' THEN ($2::jsonb->>'distancia_maxima_ativos_m')::numeric ELSE distancia_maxima_ativos_m END,
    limite_gateways = CASE WHEN $2::jsonb ? 'limite_gateways' THEN ($2::jsonb->>'limite_gateways')::integer ELSE limite_gateways END,
    relevo = CASE WHEN $2::jsonb ? 'relevo' THEN NULLIF($2::jsonb->'relevo', 'null'::jsonb) ELSE relevo END,
    vegetacoes = CASE WHEN $2::jsonb ? 'vegetacoes' THEN NULLIF($2::jsonb->'vegetacoes', 'null'::jsonb) ELSE vegetacoes END,
    edificacoes = CASE WHEN $2::jsonb ? 'edificacoes' THEN NULLIF($2::jsonb->'edificacoes', 'null'::jsonb) ELSE edificacoes END,
    antenas = CASE WHEN $2::jsonb ? 'antenas' THEN NULLIF($2::jsonb->'antenas', 'null'::jsonb) ELSE antenas END,
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
    atenuacao_adicional_db, considera_relevo, considera_vegetacao,
    considera_edificacoes, considera_antenas, criado_em, atualizado_em
  FROM perfis_rf
  WHERE ($1::bigint IS NULL OR id_usuario = $1::bigint)
  ORDER BY id_perfil_rf
  LIMIT $2 OFFSET $3`;

export const getRFProfileQuery = `
  SELECT id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, considera_relevo, considera_vegetacao,
    considera_edificacoes, considera_antenas, criado_em, atualizado_em
  FROM perfis_rf
  WHERE id_perfil_rf = $1`;

export const createRFProfileQuery = `
  INSERT INTO perfis_rf (
    id_usuario, nome, frequencia_mhz, potencia_transmissao_dbm,
    sensibilidade_recepcao_dbm, altura_gateway_m, altura_dispositivo_m,
    capacidade_max_equipamentos, atenuacao_adicional_db,
    considera_relevo, considera_vegetacao, considera_edificacoes,
    considera_antenas
  ) SELECT id_usuario, nome, frequencia_mhz, potencia_transmissao_dbm,
    sensibilidade_recepcao_dbm, altura_gateway_m, altura_dispositivo_m,
    capacidade_max_equipamentos, atenuacao_adicional_db,
    considera_relevo, considera_vegetacao, considera_edificacoes,
    considera_antenas
  FROM jsonb_populate_record(NULL::perfis_rf, $1::jsonb)
  RETURNING id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, considera_relevo, considera_vegetacao,
    considera_edificacoes, considera_antenas, criado_em, atualizado_em`;

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
    considera_relevo = CASE WHEN $2::jsonb ? 'considera_relevo' THEN ($2::jsonb->>'considera_relevo')::boolean ELSE considera_relevo END,
    considera_vegetacao = CASE WHEN $2::jsonb ? 'considera_vegetacao' THEN ($2::jsonb->>'considera_vegetacao')::boolean ELSE considera_vegetacao END,
    considera_edificacoes = CASE WHEN $2::jsonb ? 'considera_edificacoes' THEN ($2::jsonb->>'considera_edificacoes')::boolean ELSE considera_edificacoes END,
    considera_antenas = CASE WHEN $2::jsonb ? 'considera_antenas' THEN ($2::jsonb->>'considera_antenas')::boolean ELSE considera_antenas END,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id_perfil_rf = $1
  RETURNING id_perfil_rf, id_usuario, nome, frequencia_mhz,
    potencia_transmissao_dbm, sensibilidade_recepcao_dbm,
    altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos,
    atenuacao_adicional_db, considera_relevo, considera_vegetacao,
    considera_edificacoes, considera_antenas, criado_em, atualizado_em`;

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
