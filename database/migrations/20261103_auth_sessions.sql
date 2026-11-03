BEGIN;
CREATE TABLE IF NOT EXISTS public.sessoes_usuario (
  jti UUID PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES public.usuarios (id_usuario) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMPTZ NOT NULL,
  revogada_em TIMESTAMPTZ,
  CONSTRAINT sessoes_usuario_expiracao_check CHECK (expira_em > criado_em)
);
CREATE INDEX IF NOT EXISTS sessoes_usuario_usuario_idx ON public.sessoes_usuario (id_usuario);
CREATE INDEX IF NOT EXISTS sessoes_usuario_expiracao_idx ON public.sessoes_usuario (expira_em);
COMMIT;
