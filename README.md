# Backend Tecsys

API em TypeScript com Fastify e PostgreSQL.

- **[Comece aqui: como rodar e testar os critérios](docs/RunInstallCriteria.md)**
- [Preparação, atualização e verificação do banco dos critérios](database/README.md)
- [Exemplo de variáveis de ambiente](.env.example)

## Desenvolvimento

Use o PostgreSQL local configurado pela equipe. Preencha o `.env` existente com `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`. `DB_SSL` controla TLS; `PORT` configura a porta da API (padrão 3000). Não versione credenciais.

```bash
npm install
npm run dev
```

O comando inicia `src/server.ts` e carrega `.env`, sem exigir `.env.local`, Docker ou um banco específico para critérios. As configurações de outros módulos continuam no mesmo ambiente.

O CRUD de critérios usa SQL parametrizado e o driver `pg`. Não usa Supabase. O banco precisa conter as colunas da tabela `criterios_instalacao` descritas em `novo_schema.sql`. Para bancos existentes, revise as migrations em `database/migrations` antes de aplicá-las; não recrie o banco nem execute remoções de dados automaticamente.

## Verificação dos critérios

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/InstallCriterionValidation.test.ts
```

Esses testes simulam a conexão de banco e validam as rotas e regras sem depender das credenciais locais. A validação com o banco real é feita usando o ambiente PostgreSQL da equipe e o frontend apontado à porta configurada da API.

- [Contrato do CRUD de critérios](docs/InstallCriteriaApi.md)
