BEGIN;

ALTER TABLE criterios_instalacao
  ADD COLUMN IF NOT EXISTS distancia_minima_ativos_m DECIMAL(12, 2);

DO $$
BEGIN
  ALTER TABLE criterios_instalacao
    ADD CONSTRAINT criterios_instalacao_distancias_validas
    CHECK (
      distancia_minima_ativos_m IS NULL OR (
        distancia_minima_ativos_m >= 0 AND
        (distancia_maxima_ativos_m IS NULL OR
          distancia_minima_ativos_m <= distancia_maxima_ativos_m)
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMIT;