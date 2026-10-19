# Backend Tecsys

API em TypeScript com Fastify e PostgreSQL.

- [Contrato do CRUD de critérios de instalação](docs/InstallCriteriaApi.md)

## Executar a API

Requisitos: Node.js 20 ou superior, npm e `backend/.env` com as variáveis necessárias para os serviços utilizados.

Na pasta `backend`:

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` executa `tsx watch src/server.ts`, carrega `.env` e usa o banco configurado nele. As operações afetam esse banco; confira `DB_HOST` e `DB_NAME` antes de iniciar.

O CRUD de critérios utiliza SQL parametrizado em `src/database/queries.ts`, executado por `src/database/pool.ts`. Não depende do SDK nem das credenciais do Supabase.

## Estudos

Estudos usam `GET /estudos`, `POST /estudos` e `GET`, `PATCH`, `DELETE /estudos/:id`. A rota `POST /create-study` permanece compatível com a criação e também grava pelo pool PostgreSQL.

A edição altera somente nome, descrição, UF, município, bairro e os IDs de perfil RF e critério de instalação. O proprietário, a geometria, o status e os metadados são preservados. A API verifica os vínculos com o usuário, retorna 404 para estudos inexistentes e 409 quando uma chave estrangeira impede a exclusão.

## Configuração do ambiente

O arquivo `.env` deve definir `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` e `PORT`. Defina também `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` quando for usar módulos que dependem do Supabase. Sem essas credenciais, a API inicia, mas essas operações retornam erro quando chamadas.

Outros módulos da equipe ainda podem utilizar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Eles não foram migrados nesta tarefa. `.env` e demais arquivos de ambiente permanecem ignorados pelo Git; não versione credenciais.

## Verificação dos critérios

```bash
npm run build
npm test -- test/InstallCriterion.test.ts
```
