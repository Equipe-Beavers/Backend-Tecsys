-- Reversão: usar somente junto à versão anterior do backend/frontend.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.cenarios ADD COLUMN custo_total_estimado numeric;
ALTER TABLE public.cenario_gateways ADD COLUMN custo_estimado numeric;
ALTER TABLE public.perfis_rf ADD COLUMN custo_estimado_gateway numeric;
UPDATE public.cenarios c SET custo_total_estimado=b.valor FROM migration_backups.francisco_sprint3_costs b WHERE b.tabela='cenarios' AND b.id=c.id_cenario;
UPDATE public.cenario_gateways c SET custo_estimado=b.valor FROM migration_backups.francisco_sprint3_costs b WHERE b.tabela='cenario_gateways' AND b.id=c.id_cenario_gateway;
UPDATE public.perfis_rf c SET custo_estimado_gateway=b.valor FROM migration_backups.francisco_sprint3_costs b WHERE b.tabela='perfis_rf' AND b.id=c.id_perfil_rf;
COMMIT;
