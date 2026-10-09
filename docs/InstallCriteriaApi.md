# API de critérios de instalação

Contrato do CRUD baseado na tabela `criterios_instalacao` do arquivo [DER - Geomash.sql](../../DER%20-%20Geomash.sql), adotado como referência do banco em 06/10/2026.

## Compatibilidade com o DER atual

A revisão do SQL confirmou que os 13 campos da tabela de critérios, seus tipos, nulabilidade e chave estrangeira de usuário são compatíveis com o CRUD implementado. O contrato de DTOs, Controllers e rotas foi mantido, incluindo a atualização por PATCH. A persistência do Service foi adaptada do SDK Supabase para PostgreSQL via `pg`.

| Item do DER | Compatibilidade da API |
| --- | --- |
| ID `BIGINT` gerado pelo banco | Não é aceito no corpo de criação ou edição |
| `id_usuario` obrigatório, FK para `usuarios` | A chave estrangeira valida o usuário durante a gravação; a API trata a violação |
| `nome VARCHAR(150) NOT NULL` | Obrigatório na criação, com limite de 150 caracteres |
| Cinco campos JSONB opcionais | Aceitam JSON e `null`; campos omitidos no PATCH são preservados |
| Alimentação elétrica, distância e limite opcionais | Aceitam `null`, com validação dos valores informados |
| Datas de criação e atualização | Criação pelo padrão do banco e atualização com `CURRENT_TIMESTAMP` no SQL da API |
| FK `estudos.id_criterio_instalacao` sem cascata | A API converte a violação da FK na exclusão em HTTP 409 |

As regras de distância não negativa e limite de gateways positivo pertencem à API e foram mantidas. O SQL define os tipos dessas colunas, mas não adiciona restrições `CHECK` para essas regras. O DER continua sem campos de altura mínima, manutenção, relevo, vegetação ou restrições de edificações/antenas na tabela de critérios.

## Rotas

| Método | Rota | Sucesso |
| --- | --- | --- |
| POST | `/create-install-criterion` | 201, `{ message, data }` |
| GET | `/list-install-criteria` | 200, `{ data: [], page, limit }` |
| GET | `/get-install-criterion/:id` | 200, `{ data }` |
| PATCH | `/update-install-criterion/:id` | 200, `{ message, data }` |
| DELETE | `/delete-install-criterion/:id` | 204, sem corpo |

Controllers e Services usam nomes em inglês; as propriedades JSON mantêm os nomes das colunas aprovadas no banco. As rotas são definidas em `src/app.ts`. A persistência utiliza `pg` e o pool PostgreSQL configurado por `DB_*`. O SQL parametrizado está em `src/database/queries.ts`; `InstallCriterionUtils` prepara o payload, normaliza os tipos PostgreSQL e traduz violações de chaves estrangeiras.

## Campos de entrada

| Campo | Criação | Validação |
| --- | --- | --- |
| `id_usuario` | Obrigatório | Inteiro positivo; usuário deve existir |
| `nome` | Obrigatório | De 1 a 150 caracteres, com pelo menos um caractere não branco; espaços externos removidos |
| `tipos_elementos_permitidos` | Opcional | JSON |
| `tipos_elementos_proibidos` | Opcional | JSON |
| `requer_alimentacao_eletrica` | Opcional | Booleano ou `null` |
| `distancia_maxima_ativos_m` | Opcional | Número entre 0 e 9.999.999.999,99, ou `null`; persistido como decimal(12,2) |
| `locais_autorizados` | Opcional | JSON |
| `locais_obrigatorios` | Opcional | JSON |
| `locais_proibidos` | Opcional | JSON |
| `limite_gateways` | Opcional | Inteiro de 1 a 2.147.483.647, ou `null` |

Campos JSONB aceitam objetos, listas, escalares JSON e `null`: o modelo recebido não define uma estrutura interna obrigatória. Regras como identificar conflitos entre locais obrigatórios e proibidos dependem de um contrato para esses conteúdos e não são inferidas neste CRUD.

O critério mínimo aceito contém usuário e nome. Opcionais omitidos na criação são gravados como `null`. O banco define `criado_em` com seu valor padrão e gera `id_criterio_instalacao`. Ambos, assim como `atualizado_em`, não podem ser enviados pelo cliente.

IDs são aceitos até `Number.MAX_SAFE_INTEGER` (9.007.199.254.740.991), limite de representação exata utilizado pela aplicação JavaScript, mesmo que a coluna PostgreSQL seja BIGINT.

Os campos removidos do novo modelo — `descricao`, `altura_minima_m`, `caracteristicas_minimas_local` e `custo_maximo` — são rejeitados, assim como outras propriedades desconhecidas.

## Exemplos

Os IDs são ilustrativos. Substitua pelo usuário existente e pelo ID retornado na criação.

```http
POST /create-install-criterion
Content-Type: application/json

{
  "id_usuario": 1,
  "nome": "Postes e torres",
  "tipos_elementos_permitidos": ["POSTE", "TORRE"],
  "requer_alimentacao_eletrica": true,
  "distancia_maxima_ativos_m": 1500,
  "limite_gateways": 5
}
```

```http
GET /list-install-criteria?id_usuario=1&page=1&limit=20
```

A listagem permite filtrar por `id_usuario`. Sem filtro, lista os critérios disponíveis à conexão do backend. A paginação começa em 1; o limite padrão é 50, com máximo de 100. A ordenação é pelo identificador crescente. Uma página sem registros retorna `data: []`; percorra páginas até uma resposta com menos itens que o limite. `page` tem máximo de 21.474.836.

```http
GET /get-install-criterion/7
```

```http
PATCH /update-install-criterion/7
Content-Type: application/json

{
  "nome": "Postes e torres — revisão",
  "limite_gateways": null
}
```

O PATCH deve conter pelo menos um campo editável. Campos omitidos permanecem inalterados; `null` limpa um campo opcional. `nome` e `id_usuario` não aceitam `null`. Se o usuário for alterado, sua existência é validada pela chave estrangeira durante a atualização. A API atualiza `atualizado_em` automaticamente.

```http
DELETE /delete-install-criterion/7
```

## Erros

| Código | Significado |
| --- | --- |
| 400 | Entrada inválida, campo desconhecido, atualização vazia ou usuário inexistente |
| 404 | Critério não encontrado, inclusive em atualização e exclusão |
| 409 | Exclusão impedida por referência ao critério em outro registro |
| 500 | Falha inesperada de persistência/conexão; detalhes ficam no log do servidor |

Os erros de negócio retornam `{ message }`. A validação de schema usa o formato padrão do Fastify, incluindo `statusCode`, `code` e `message`.

## Banco e integração

A única referência válida do banco é [DER - Geomash.sql](../../DER%20-%20Geomash.sql), na raiz do repositório principal. `backend/database/schema.sql` é obsoleto e deve ser ignorado; não há pendência de sincronizá-lo. Novas tarefas e revisões devem seguir exclusivamente o DER aprovado.

O DER é um script de criação, não uma migração para bancos já existentes. O DER foi aplicado somente ao banco local isolado de testes. Nenhuma migração ou consulta foi executada na AWS nesta adaptação.

A exclusão depende da integridade referencial do banco. No novo modelo deve existir a chave estrangeira de `estudos.id_criterio_instalacao` para `criterios_instalacao.id_criterio_instalacao`, sem exclusão em cascata. A violação de FK é convertida em 409; um banco sem essa relação não oferece essa proteção.

O módulo usa PostgreSQL diretamente, sem Supabase. O [ambiente local](LocalCriteriaDatabase.md) usa `.env.local`, preservando a configuração AWS em `.env`. `id_usuario` é um dado de relacionamento e filtro, não autenticação. Autenticação e autorização por usuário não foram implementadas nesta tarefa.

A biblioteca e o seletor de critérios do frontend consomem estas rotas, com páginas de 20 registros carregadas sob demanda. O seletor usa o mesmo modelo tipado da biblioteca e envia o ID escolhido no payload de criação do estudo. A adequação do endpoint e do serviço de estudos ao DER continua fora deste CRUD.

## Organização e consultas

A criação usa uma única operação de inserção; o PATCH usa uma única operação de atualização com retorno do registro. A chave estrangeira de `id_usuario` é a validação definitiva e a violação `23503` é convertida em HTTP 400. Isso dispensa consultas preliminares e a duplicação da validação genérica de existência. A ausência de registro no retorno da atualização gera HTTP 404. A exclusão permanece protegida pelas referências do banco, com HTTP 409.

## Validação

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/LocalDatabaseConfig.test.ts
npm run test:criteria:local
```

Os testes unitários exercitam as rotas Fastify e substituem o pool PostgreSQL por resultados controlados. Os testes de configuração verificam o bloqueio de acesso remoto sem abrir conexão. O comando `test:criteria:local` executa o CRUD no banco local real com o DER aprovado, incluindo a proteção de exclusão por estudo, e remove seus próprios registros temporários ao finalizar. Não valida o ambiente AWS.
