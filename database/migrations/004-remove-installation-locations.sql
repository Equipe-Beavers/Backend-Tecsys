BEGIN;

ALTER TABLE criterios_instalacao
  DROP COLUMN IF EXISTS locais_autorizados,
  DROP COLUMN IF EXISTS locais_obrigatorios,
  DROP COLUMN IF EXISTS locais_proibidos;

COMMIT;