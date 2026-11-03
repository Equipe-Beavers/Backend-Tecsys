-- Aplicar uma vez em bancos existentes; não exclui nem altera usuários.
-- Se houver duplicatas normalizadas, a transação falha e exige revisão manual.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_normalizado_key
  ON usuarios (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_normalizado_key
  ON usuarios (lower(btrim(username)));
COMMIT;
