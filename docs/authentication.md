# Autenticação — SCRUM-75 e SCRUM-76 / US70

## Preparação

1. Execute `npm install` na pasta `backend`.
2. Configure `JWT_SECRET` no `.env` com um segredo aleatório de pelo menos 32 bytes; gere-o com `openssl rand -hex 32`. Não versione o segredo. Instâncias do backend devem compartilhar esse valor. Sem configuração válida, o login retorna `503 AUTH_NOT_CONFIGURED`.
3. Em um banco existente, aplique `database/migrations/20261103_auth_user_uniqueness.sql` com um cliente PostgreSQL. A migração cria índices únicos para e-mail e username desconsiderando maiúsculas e espaços externos. Se houver duplicatas, a transação falha sem remover dados; resolva os registros antes de reaplicar. Os dois schemas versionados já contêm os índices para instalações novas.
4. Aplique também `database/migrations/20261103_auth_sessions.sql`, que cria a tabela de sessões e seus índices, sem alterar registros de usuários. Os schemas para bancos novos também incluem essa estrutura.
5. Inicie com `npm run dev` (reinicie o processo após configurar o segredo).

A implementação e os testes não executam essa migração no banco configurado automaticamente.

## Cadastro

`POST /auth/register` recebe:

```json
{
  "username": "Rafael Coelho",
  "email": "rafael@example.com",
  "senha": "Uma senha longa!"
}
```

O campo `username` representa o nome exibido no protótipo, aceita espaços e tem entre 3 e 100 caracteres após normalização. O e-mail é validado e salvo em minúsculas. A senha tem entre 8 e 128 caracteres e não sofre trim. O cliente não envia `senha_hash` nem `id_usuario`. Não é necessário enviar a confirmação de senha ao backend.

O servidor gera o hash usando scrypt assíncrono (`N=32768`, `r=8`, `p=3`, salt aleatório de 16 bytes e chave de 64 bytes). Apenas dados públicos são devolvidos:

```json
{
  "message": "Usuário criado com sucesso!",
  "data": {
    "id_usuario": 42,
    "username": "Rafael Coelho",
    "email": "rafael@example.com",
    "criado_em": "2026-11-03T12:00:00.000Z",
    "atualizado_em": null
  }
}
```

Sucesso: `201`. Dados inválidos: `400`. E-mail ou username duplicados: `409`, com código `EMAIL_ALREADY_EXISTS` ou `USERNAME_ALREADY_EXISTS`. Erros internos retornam `500` sem detalhes do banco.

`POST /usuarios` e `POST /create-user` são aliases para a mesma implementação persistente. O contrato anterior que aceitava um hash pronto foi removido. Os três endereços compartilham o limite de 5 cadastros por IP a cada 15 minutos.

## Login e identificação

`POST /auth/login` recebe `email` e `senha`. A resposta `200` contém:

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "usuario": {
    "id_usuario": 42,
    "username": "Rafael Coelho",
    "email": "rafael@example.com",
    "criado_em": "2026-11-03T12:00:00.000Z",
    "atualizado_em": null
  }
}
```

Credenciais incorretas ou usuário inexistente retornam o mesmo `401 INVALID_CREDENTIALS`. São permitidas 10 tentativas por IP em 15 minutos; o excesso retorna `429` com `Retry-After`. O limitador usa memória local por processo; vários processos requerem um armazenamento compartilhado antes da implantação distribuída.

O JWT é assinado com HS256, usa `sub` para o ID, `jti` aleatório para a sessão, emissor `geomash`, audiência `geomash-app` e expira em uma hora. Não contém senha nem hash. O segredo não é enviado ao frontend. As respostas de autenticação e dos recursos protegidos usam `Cache-Control: no-store`. Em implantação, as credenciais e os tokens devem trafegar por HTTPS.

`GET /auth/me`, com `Authorization: Bearer <access_token>`, retorna `{ "usuario": { ... } }`. Tokens ausentes, expirados, adulterados ou com emissor/audiência inválidos retornam `401`. Um usuário removido do banco também recebe `401` nessa consulta.

O preHandler `authenticate`, exportado em `src/modules/auth.routes.ts`, pode ser usado em outras rotas para preencher `request.user.sub` a partir do JWT validado. O plugin JWT está registrado no escopo raiz do Fastify para permitir esse uso nos módulos existentes.

## Recursos persistentes e isolamento

Estudos, pontos, recomendações, cenários, gateways/atendimentos dos cenários, critérios, perfis RF e geração/consulta de cobertura exigem `Authorization: Bearer <access_token>`. Os aliases antigos recebem a mesma proteção. Consultas públicas de ativos/regiões e cálculos sem recursos persistentes continuam disponíveis.

O proprietário é derivado de `request.user.sub`, nunca escolhido pelo cliente. O frontend pode omitir `id_usuario` ao criar/listar recursos; se informar outro usuário, recebe `403 USER_MISMATCH`. Alterar o proprietário em PATCH retorna `400 IMMUTABLE_OWNER`. Consultar, alterar ou excluir recursos de outro usuário retorna `404`. As consultas SQL filtram pelo proprietário; referências a perfis, critérios, cenários e pontos também são verificadas, incluindo a pertença ao mesmo estudo.

## Sessão e logout

Cada login persiste uma sessão em `sessoes_usuario`. Toda requisição protegida verifica assinatura, expiração e sessão ativa no banco; falhas de acesso à tabela retornam `503`, sem liberar o recurso. Tokens antigos sem `jti`/sessão registrada exigem novo login.

`POST /auth/logout`, autenticado com o token atual, retorna `204` e revoga essa sessão imediatamente para as próximas requisições, inclusive entre instâncias e reinícios. Outras sessões permanecem válidas. O frontend deve chamar essa rota antes de descartar o token; apenas descartá-lo localmente não solicita revogação. Sessões expiradas ou revogadas não são reutilizadas; a limpeza periódica desses registros pode ser configurada operacionalmente.

A interface ainda precisa integrar login, armazenamento do token, envio do cabeçalho e logout. Clientes atuais que não enviam JWT passam a receber `401` nos recursos persistentes. Renovação de tokens e recuperação de senha continuam fora desta entrega.

Usuários antigos que tenham texto puro ou hashes incompatíveis em `senha_hash` não recebem bypass nem conversão automática: precisam de uma senha redefinida por um fluxo apropriado. Nenhum usuário existente é alterado pela implementação.

## Validação

`npm run build` e `npm test`. Os testes de autenticação usam hash e JWT reais e simulam o PostgreSQL para não criar usuários no banco compartilhado.

Existe também `test/auth.postgres.test.ts`, uma suíte opcional executada contra uma instância descartável de PostgreSQL 18 com PostGIS. Ela recria o schema público nesse banco temporário a partir do arquivo versionado e verifica migrações, hash, login, concorrência dos índices, isolamento de dois usuários e revogação entre instâncias. É ignorada por padrão e só aceita `AUTH_POSTGRES_TEST_SOCKET` no formato `/tmp/geomash-auth-pg.<sufixo>`. Use exclusivamente uma instância descartável na porta `55475`, usuário `auth_test`, banco `postgres` e socket local nesse diretório. A suíte substitui as configurações de conexão no próprio processo de teste, sem modificar `.env` nem usar AWS. `test/resource-protection.test.ts` verifica também que nenhuma rota alternativa protegida admite acesso anônimo.
