// SQL for installation criteria. Values are always supplied as parameters.
const criterionColumns = `id_criterio_instalacao, id_usuario, nome,
  tipos_elementos_permitidos, tipos_elementos_proibidos,
  requer_alimentacao_eletrica, distancia_maxima_ativos_m,
  locais_autorizados, locais_obrigatorios, locais_proibidos,
  limite_gateways, criado_em, atualizado_em`;

export const createInstallCriterionQuery = `
  INSERT INTO criterios_instalacao (
    id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_maxima_ativos_m,
    locais_autorizados, locais_obrigatorios, locais_proibidos, limite_gateways
  ) SELECT id_usuario, nome, tipos_elementos_permitidos, tipos_elementos_proibidos,
    requer_alimentacao_eletrica, distancia_maxima_ativos_m,
    locais_autorizados, locais_obrigatorios, locais_proibidos, limite_gateways
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
    locais_autorizados = CASE WHEN $2::jsonb ? 'locais_autorizados' THEN NULLIF($2::jsonb->'locais_autorizados', 'null'::jsonb) ELSE locais_autorizados END,
    locais_obrigatorios = CASE WHEN $2::jsonb ? 'locais_obrigatorios' THEN NULLIF($2::jsonb->'locais_obrigatorios', 'null'::jsonb) ELSE locais_obrigatorios END,
    locais_proibidos = CASE WHEN $2::jsonb ? 'locais_proibidos' THEN NULLIF($2::jsonb->'locais_proibidos', 'null'::jsonb) ELSE locais_proibidos END,
    limite_gateways = CASE WHEN $2::jsonb ? 'limite_gateways' THEN ($2::jsonb->>'limite_gateways')::integer ELSE limite_gateways END,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id_criterio_instalacao = $1
  RETURNING ${criterionColumns}`;

export const deleteInstallCriterionQuery = `
  DELETE FROM criterios_instalacao WHERE id_criterio_instalacao = $1
  RETURNING id_criterio_instalacao`;
