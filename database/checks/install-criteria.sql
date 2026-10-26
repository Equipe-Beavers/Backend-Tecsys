-- Diagnóstico somente de leitura. Confere a estrutura esperada de database/schema.sql.
-- Não lista credenciais nem registros de usuários.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS banco, current_schema() AS schema,
       inet_server_addr() AS endereco_servidor, inet_server_port() AS porta;

WITH required_columns(column_name, expected_type, expected_nullable) AS (VALUES
  ('id_criterio_instalacao', 'bigint', 'NO'),
  ('id_usuario', 'bigint', 'NO'),
  ('nome', 'character varying', 'NO'),
  ('tipos_elementos_permitidos', 'jsonb', 'YES'),
  ('tipos_elementos_proibidos', 'jsonb', 'YES'),
  ('distancia_minima_ativos_m', 'numeric', 'YES'),
  ('distancia_maxima_ativos_m', 'numeric', 'YES'),
  ('limite_gateways', 'integer', 'YES'),
  ('relevo', 'jsonb', 'YES'),
  ('criado_em', 'timestamp without time zone', 'NO'),
  ('atualizado_em', 'timestamp without time zone', 'YES')
)
SELECT r.column_name AS coluna, r.expected_type AS tipo_esperado,
       c.data_type AS tipo_atual, c.is_nullable AS aceita_null,
       c.column_default AS padrao, c.is_identity AS identidade,
       c.character_maximum_length AS tamanho, c.numeric_precision AS precisao,
       c.numeric_scale AS escala,
       CASE WHEN c.column_name IS NULL THEN 'AUSENTE'
            WHEN c.data_type <> r.expected_type OR c.is_nullable <> r.expected_nullable THEN 'REVISAR'
            ELSE 'TIPO E NULABILIDADE OK' END AS resultado
FROM required_columns r
LEFT JOIN information_schema.columns c ON c.table_schema = current_schema()
  AND c.table_name = 'criterios_instalacao' AND c.column_name = r.column_name
ORDER BY r.column_name;

-- Conferir PK, FK de usuário e os dois CHECKs de distância pelas definições.
-- Também mostra a FK de estudos que protege critérios em uso contra exclusão.
SELECT conrelid::regclass AS tabela, conname AS restricao,
       convalidated AS validada, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = to_regclass('criterios_instalacao')
   OR (contype = 'f' AND confrelid = to_regclass('criterios_instalacao'))
ORDER BY conrelid, conname;

SELECT tablename AS tabela, indexname AS indice, indexdef AS definicao
FROM pg_indexes WHERE schemaname = current_schema()
  AND tablename IN ('criterios_instalacao', 'estudos')
ORDER BY tablename, indexname;

SELECT column_name AS coluna_legada
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name = 'criterios_instalacao'
  AND column_name IN ('locais_autorizados', 'locais_obrigatorios', 'locais_proibidos');

COMMIT;
