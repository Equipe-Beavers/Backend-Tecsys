-- Requer as colunas de distância da migration 003.
-- Não corrige registros antigos automaticamente. Se houver valores fora da
-- faixa, a transação falha e o banco permanece inalterado. Revise-os primeiro.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'criterios_instalacao'::regclass
      AND conname = 'criterios_instalacao_distancias_faixa'
  ) THEN
    ALTER TABLE criterios_instalacao
      ADD CONSTRAINT criterios_instalacao_distancias_faixa CHECK (
        (distancia_minima_ativos_m IS NULL OR distancia_minima_ativos_m BETWEEN 10 AND 500)
        AND (distancia_maxima_ativos_m IS NULL OR distancia_maxima_ativos_m BETWEEN 10 AND 500)
      );
  END IF;
END
$$;

COMMIT;
