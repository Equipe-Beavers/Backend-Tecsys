# Backend Tecsys

API em TypeScript com Fastify e PostgreSQL.

- [Contrato do CRUD de critérios de instalação](docs/InstallCriteriaApi.md)
- [Banco local, dados fictícios e testes dos critérios](docs/LocalCriteriaDatabase.md)

## Desenvolvimento local dos critérios

Requisitos: Node.js (20 ou superior, com suporte a `--import`), npm e Docker Compose. Use o repositório principal com `DER - Geomash.sql` na raiz; ele é a única referência válida. Ignore `backend/database/schema.sql`.

Na pasta `backend`:

```bash
npm install
```

Se `.env.local` ainda não existir, copie `.env.local.example` para `.env.local`. Preserve o `.env` existente, que contém as configurações da AWS.

```bash
npm run db:local:up
npm run dev
```

`npm run dev` inicia o modo local, equivalente a `npm run dev:local`. O banco fica em `127.0.0.1:5433`, e a API em `http://localhost:3001`. O DER e os dados fictícios são aplicados automaticamente na primeira criação do volume. O Supabase fica bloqueado nesse modo.

O CRUD de critérios utiliza SQL parametrizado em `src/database/queries.ts`, executado por `src/database/pool.ts`. Não depende do SDK nem das credenciais do Supabase.

## Estudos no Banco de Desenvolvimento Local

Com o banco PostgreSQL de desenvolvimento já inicializado e configurado com host local no `.env`, execute `npm run dev:loopback` para servir a API na porta 3000, com Supabase e acesso remoto bloqueados. Estudos usam `GET /estudos`, `POST /estudos` e `GET`, `PATCH`, `DELETE /estudos/:id`. A rota `POST /create-study` permanece compatível com a criação e também grava pelo pool PostgreSQL.

A edição altera somente nome, descrição, UF, município, bairro e os IDs de perfil RF e critério de instalação. O proprietário, a geometria, o status e os metadados são preservados. A API verifica os vínculos com o usuário, retorna 404 para estudos inexistentes e 409 quando uma chave estrangeira impede a exclusão. O banco isolado na porta 5433 precisa ter seu schema inicializado antes de ser utilizado.

## Configuração AWS preservada

O arquivo `.env` continua guardando `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` e `PORT` do ambiente remoto. Ele não foi sobrescrito por dados locais.

Somente quando desejar acessar a AWS, utilize explicitamente:

```bash
npm run dev:aws
```

Esse comando carrega `.env` e habilita acesso PostgreSQL remoto. A execução padrão bloqueia hosts remotos sem `ALLOW_REMOTE_DATABASE=true`. Ao iniciar o build com `npm start` em um ambiente remoto, forneça essa autorização explicitamente nas variáveis de implantação.

Outros módulos da equipe ainda podem utilizar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Eles não foram migrados nesta tarefa e não devem ser testados através do modo local de critérios, que bloqueia o SDK. Seus valores existentes foram preservados. `.env` e `.env.local` permanecem ignorados pelo Git; somente o exemplo local com credenciais fictícias pode ser versionado.

## Verificação dos critérios

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/LocalDatabaseConfig.test.ts
npm run test:criteria:local
```

O último comando requer o contêiner local iniciado. Não acessa a AWS, não acessa Supabase e remove seus registros temporários ao finalizar.
