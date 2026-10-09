# Testes locais dos critérios de instalação

O CRUD de critérios utiliza PostgreSQL pelo driver `pg`, sem acessar o Supabase. As rotas e o contrato do frontend foram mantidos. O SQL parametrizado está em `src/database/queries.ts`.

## Ambientes separados

| Configuração | Desenvolvimento local | AWS |
| --- | --- | --- |
| Arquivo | `.env.local` | `.env` existente, preservado |
| Banco | `geomash_criteria_test` | Banco já configurado pela equipe |
| Host/porta PostgreSQL | `127.0.0.1:5433` | `DB_HOST` e `DB_PORT` do `.env` |
| API | `http://localhost:3001` | `PORT` do `.env` |
| Comando | `npm run dev:local` ou `npm run dev` | `npm run dev:aws` (acesso remoto explícito) |
| Supabase | Bloqueado | Não utilizado pelos critérios; outros módulos mantêm sua implementação |

O carregador local sobrescreve as variáveis do processo com `.env.local` antes de importar a aplicação. Verifica o host, porta, nome e usuário esperados, desativa o Supabase e bloqueia acesso remoto. Assim, as credenciais da AWS podem permanecer no `.env` sem serem usadas nos testes locais.

A configuração compartilhada de PostgreSQL rejeita hosts remotos sem `ALLOW_REMOTE_DATABASE=true`. O comando `dev:aws` habilita essa opção explicitamente. Para execução remota do build com `npm start`, essa variável também deve ser fornecida pelo ambiente de implantação. Nenhum desses modos remotos foi executado nesta entrega.

## Iniciar

Requisitos: Node.js com suporte a `--import`, dependências do backend instaladas e Docker Compose. Use o checkout principal, com o arquivo `DER - Geomash.sql` ao lado da pasta `backend`.

Na pasta `backend`, se `.env.local` ainda não existir, copie `.env.local.example` para `.env.local`. A cópia já foi preparada no ambiente de desenvolvimento desta entrega. Não substitua o `.env` da AWS.

```bash
npm run db:local:up
npm run dev:local
```

O Compose utiliza `postgis/postgis:16-3.4`, um volume próprio e a porta 5433, sem alterar o contêiner PostgreSQL anterior da equipe na porta 5432. A porta do banco é exposta somente em `127.0.0.1`; o celular acessa a API, não o PostgreSQL.

Na primeira criação do volume, o contêiner executa:

1. O arquivo original `../DER - Geomash.sql`, montado somente para leitura.
2. `database/local/002-criteria-seed.sql`, com dados fictícios.

`backend/database/schema.sql` não é utilizado. O DER completo é aplicado para que as chaves estrangeiras e os tipos geográficos sejam iguais aos aprovados, sem implementar as funcionalidades dos outros módulos. Alterar o DER depois de criar o volume não aplica uma migração automaticamente.

## Dados de teste

| Registro | Finalidade |
| --- | --- |
| Usuário 1 — `teste_criterios` | Usuário padrão do frontend (`APP_USER_ID=1`) |
| Usuário 2 — `teste_outro_usuario` | Conferir isolamento da listagem pelo filtro de usuário |
| Critério 1 — `[TESTE LOCAL] Sem restrições` | Campos opcionais nulos |
| Critério 2 — `[TESTE LOCAL] Postes e subestações` | Listas JSONB, alimentação elétrica, distância e limite |
| Critério 3 — `[TESTE LOCAL] Em uso — exclusão bloqueada` | Testar retorno 409 ao tentar excluir |
| Critério 4 — `[TESTE LOCAL] Outro usuário` | Aparece somente na listagem do usuário 2, quando filtrada |

Um perfil de RF e um estudo fictícios existem apenas como dependências do critério 3 para testar a proteção de exclusão. Não há dados de ativos BDGD, mapas ou cenários reais. Os usuários não possuem senha funcional: autenticação permanece fora desta sprint.

A carga inicial usa `ON CONFLICT DO NOTHING`: não substitui registros existentes. As sequências dos IDs são ajustadas para permitir novas criações pelo formulário. Os dados persistem no volume ao parar e iniciar o contêiner.

## Apontar o frontend para o backend local

Na pasta `frontend`, encerre a execução anterior do Flutter e execute:

```bash
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3001 --dart-define=APP_USER_ID=1
```

Em celular físico conectado à mesma rede, use o IP atual do computador:

```bash
flutter run -d ID_DO_CELULAR --dart-define=API_BASE_URL=http://IP_DO_COMPUTADOR:3001 --dart-define=APP_USER_ID=1
```

Em emulador Android, use `http://10.0.2.2:3001`. O endereço definido com `--dart-define` exige reiniciar a execução; hot reload não altera essa configuração. Os padrões antigos do frontend ainda apontam para a porta 3000, portanto informe explicitamente a porta **3001** neste ambiente.

## Validar

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/LocalDatabaseConfig.test.ts
npm run test:criteria:local
```

Os testes unitários substituem o pool por resultados controlados e não abrem conexões remotas. O teste de integração usa o banco local real e as rotas Fastify via `inject`, sem exigir um servidor HTTP em execução. Valida criação, consulta, paginação, atualização parcial, JSONB, datas, normalização numérica, chaves estrangeiras e exclusão. Os registros temporários que ele cria são excluídos ao terminar; a carga inicial é preservada.

O teste local valida a configuração antes de importar a conexão. Ele não pode ser direcionado à AWS por `DB_HOST` herdado do terminal.

## Parar

Encerre o backend com `Ctrl+C`. Para parar o banco mantendo os dados:

```bash
npm run db:local:stop
```

Esta entrega não executou consultas nem alterações na AWS e não copiou registros do Supabase. Os dados locais são exclusivamente fictícios.
