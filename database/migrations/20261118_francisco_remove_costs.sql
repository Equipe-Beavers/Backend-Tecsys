BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS migration_backups;
CREATE TABLE IF NOT EXISTS migration_backups.francisco_sprint3_costs (
  tabela text NOT NULL, id bigint NOT NULL, valor numeric,
  arquivado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tabela, id)
);
INSERT INTO migration_backups.francisco_sprint3_costs(tabela,id,valor)
  SELECT 'cenarios',id_cenario,custo_total_estimado FROM public.cenarios ON CONFLICT DO NOTHING;
INSERT INTO migration_backups.francisco_sprint3_costs(tabela,id,valor)
  SELECT 'cenario_gateways',id_cenario_gateway,custo_estimado FROM public.cenario_gateways ON CONFLICT DO NOTHING;
INSERT INTO migration_backups.francisco_sprint3_costs(tabela,id,valor)
  SELECT 'perfis_rf',id_perfil_rf,custo_estimado_gateway FROM public.perfis_rf ON CONFLICT DO NOTHING;
ALTER TABLE public.cenarios DROP COLUMN custo_total_estimado;
ALTER TABLE public.cenario_gateways DROP COLUMN custo_estimado;
ALTER TABLE public.perfis_rf DROP COLUMN custo_estimado_gateway;
COMMIT;
