-- FICTITIOUS DATA. Only for the isolated local criteria test database.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'geomash_criteria_test' THEN
    RAISE EXCEPTION 'This seed is restricted to geomash_criteria_test';
  END IF;
END $$;

INSERT INTO usuarios (id_usuario, username, email, senha_hash) VALUES
  (1, 'teste_criterios', 'criterios@example.invalid', 'FICTICIO_SEM_LOGIN'),
  (2, 'teste_outro_usuario', 'outro@example.invalid', 'FICTICIO_SEM_LOGIN')
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO criterios_instalacao (
  id_criterio_instalacao, id_usuario, nome, tipos_elementos_permitidos,
  tipos_elementos_proibidos, requer_alimentacao_eletrica,
  distancia_maxima_ativos_m, locais_autorizados, locais_obrigatorios,
  locais_proibidos, limite_gateways
) VALUES
  (1, 1, '[TESTE LOCAL] Sem restrições', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (2, 1, '[TESTE LOCAL] Postes e subestações', '["POSTE","SUBESTACAO"]', '["ESTRUTURA_PROVISORIA"]',
   TRUE, 1500, '["POSTE:FICTICIO-1","SUBESTACAO:FICTICIA-1"]', '[]', '["LOCAL:FICTICIO-RESTRITO"]', 10),
  (3, 1, '[TESTE LOCAL] Em uso — exclusão bloqueada', '["TORRE"]', '[]',
   FALSE, 3000, '[]', '[]', '[]', 5),
  (4, 2, '[TESTE LOCAL] Outro usuário', '["POSTE"]', NULL, FALSE, 0, NULL, NULL, NULL, 1)
ON CONFLICT (id_criterio_instalacao) DO NOTHING;

-- Minimal dependencies to exercise the criterion's foreign-key deletion guard.
-- These are fixtures only, not implementations of the RF/studies modules.
INSERT INTO perfis_rf (
  id_perfil_rf, id_usuario, nome, frequencia_mhz,
  potencia_transmissao_dbm, sensibilidade_recepcao_dbm
) VALUES (1, 1, '[TESTE LOCAL] Dependência para teste de FK', 915, 14, -120)
ON CONFLICT (id_perfil_rf) DO NOTHING;

INSERT INTO estudos (
  id_estudo, id_usuario, id_perfil_rf, id_criterio_instalacao,
  tipo_delimitacao, nome, status
) VALUES (1, 1, 1, 3, 'desenho', '[TESTE LOCAL] Bloqueio de exclusão de critério', 'RASCUNHO')
ON CONFLICT (id_estudo) DO NOTHING;

SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), GREATEST((SELECT MAX(id_usuario) FROM usuarios), (SELECT last_value FROM usuarios_id_usuario_seq)));
SELECT setval(pg_get_serial_sequence('criterios_instalacao', 'id_criterio_instalacao'), GREATEST((SELECT MAX(id_criterio_instalacao) FROM criterios_instalacao), (SELECT last_value FROM criterios_instalacao_id_criterio_instalacao_seq)));
SELECT setval(pg_get_serial_sequence('perfis_rf', 'id_perfil_rf'), GREATEST((SELECT MAX(id_perfil_rf) FROM perfis_rf), (SELECT last_value FROM perfis_rf_id_perfil_rf_seq)));
SELECT setval(pg_get_serial_sequence('estudos', 'id_estudo'), GREATEST((SELECT MAX(id_estudo) FROM estudos), (SELECT last_value FROM estudos_id_estudo_seq)));
COMMIT;
