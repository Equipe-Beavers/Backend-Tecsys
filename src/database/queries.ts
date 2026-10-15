// SQL for installation criteria. Values are always supplied as parameters.
const criterionColumns = `id_criterio_instalacao, id_usuario, nome,
  tipos_elementos_permitidos, tipos_elementos_proibidos,
  requer_alimentacao_eletrica, distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
  relevo, vegetacoes, edificacoes, antenas, criado_em, atualizado_em`;

export const createInstallCriterionQuery = `
  INSERT INTO criterios_instalacao (
    id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
    relevo, vegetacoes, edificacoes, antenas
  ) SELECT id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways,
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
    distancia_minima_ativos_m = CASE WHEN $2::jsonb ? 'distancia_minima_ativos_m' THEN ($2::jsonb->>'distancia_minima_ativos_m')::numeric ELSE distancia_minima_ativos_m END,
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

export const lockInstallCriterionQuery = `SELECT tipos_elementos_permitidos, tipos_elementos_proibidos
  FROM criterios_instalacao WHERE id_criterio_instalacao = $1 FOR UPDATE`;
export const beginCriterionTransactionQuery = 'BEGIN';
export const commitCriterionTransactionQuery = 'COMMIT';
export const rollbackCriterionTransactionQuery = 'ROLLBACK';
