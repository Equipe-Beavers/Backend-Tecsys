# API de critérios de instalação

Contrato do CRUD baseado na tabela `criterios_instalacao` do schema local [novo_schema.sql](../novo_schema.sql).

## Compatibilidade com o DER atual

O CRUD usa somente colunas existentes na tabela local. A persistência usa PostgreSQL via `pg`, incluindo criação, listagem, consulta, atualização parcial por PATCH e exclusão.

| Item do DER | Compatibilidade da API |
| --- | --- |
| ID `BIGINT` gerado pelo banco | Não é aceito no corpo de criação ou edição |
| `id_usuario` obrigatório, FK para `usuarios` | A chave estrangeira valida o usuário durante a gravação; a API trata a violação |
| `nome VARCHAR(150) NOT NULL` | Obrigatório na criação, com limite de 150 caracteres |
| Seis campos JSONB opcionais | Tipos de ativos, relevo, vegetações, edificações e antenas; aceitam JSON e `null` |
| Alimentação elétrica, distância máxima e limite opcionais | Aceitam `null`, com validação dos valores informados |
| Datas de criação e atualização | Criação pelo padrão do banco e atualização com `CURRENT_TIMESTAMP` no SQL da API |
| FK `estudos.id_criterio_instalacao` sem cascata | A API converte a violação da FK na exclusão em HTTP 409 |

A API valida os limites de distância (10–500 m), os tipos elétricos e as propriedades conhecidas das seções JSONB.

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
| `tipos_elementos_permitidos` | Opcional | Lista de códigos de ativos elétricos das camadas ou `null` |
| `tipos_elementos_proibidos` | Opcional | Lista de códigos de ativos elétricos das camadas ou `null` |
| `requer_alimentacao_eletrica` | Opcional | Booleano ou `null` |
| `distancia_minima_ativos_m` | Opcional | Número entre 10 e 500 ou `null`; não pode ultrapassar a máxima quando ambas existirem |
| `distancia_maxima_ativos_m` | Opcional | Número entre 10 e 500, ou `null`; persistido como decimal(12,2) |
| `limite_gateways` | Opcional | Inteiro de 1 a 2.147.483.647, ou `null` |
| `relevo` | Opcional | JSONB ou `null`; a interface usa `altitude_minima_m`, `altitude_maxima_m` e `declividade_maxima_graus` |
| `vegetacoes` | Opcional | JSONB ou `null`; a interface usa listas `permitidas` e `proibidas` |
| `edificacoes` | Opcional | JSONB ou `null`; contém raio, quantidade máxima, altura máxima e distância mínima |
| `antenas` | Opcional | JSONB ou `null`; contém raio, quantidade máxima, distância máxima e conflito de frequência |

As listas de ativos aceitam somente códigos do catálogo elétrico ou `null`. As demais seções aceitam objetos ou `null`.

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
  "nome": "Postes e subestações",
  "tipos_elementos_permitidos": ["POSTE", "SUBESTACAO"],
  "tipos_elementos_proibidos": ["TRANSFORMADOR"],
  "requer_alimentacao_eletrica": true,
  "distancia_minima_ativos_m": 10,
  "distancia_maxima_ativos_m": 500,
  "limite_gateways": 5,
  "relevo": {"altitude_minima_m": 100, "altitude_maxima_m": 900, "declividade_maxima_graus": 20},
  "vegetacoes": {"permitidas": ["PASTAGEM"], "proibidas": ["MANGUE"]},
  "edificacoes": {"raio_analise_m": 300, "quantidade_maxima": 4, "altura_maxima_m": 20, "distancia_minima_m": 10},
  "antenas": {"raio_analise_m": 500, "quantidade_maxima": 2, "distancia_maxima_m": 1000, "considerar_conflito_frequencia": true}
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
  "nome": "Postes e subestações — revisão",
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

O CRUD exige `distancia_minima_ativos_m` e `distancia_maxima_ativos_m`. Para bancos existentes, aplique `database/migrations/003-install-criterion-min-distance.sql` antes de iniciar esta versão da API. Ela adiciona a coluna mínima opcional e o CHECK de ordem dos limites, sem preencher ou excluir valores antigos. O novo_schema.sql já contém a coluna e o CHECK. Nenhuma migração é executada pela interface.

A exclusão depende da integridade referencial do banco. No novo modelo deve existir a chave estrangeira de `estudos.id_criterio_instalacao` para `criterios_instalacao.id_criterio_instalacao`, sem exclusão em cascata. A violação de FK é convertida em 409; um banco sem essa relação não oferece essa proteção.

O módulo usa PostgreSQL diretamente, sem Supabase. O backend utiliza o `.env` existente, com o PostgreSQL configurado pelo time. `id_usuario` é um dado de relacionamento e filtro, não autenticação. Autenticação e autorização por usuário não foram implementadas nesta tarefa.

A biblioteca e o seletor de critérios do frontend consomem estas rotas, com páginas de 20 registros carregadas sob demanda. O seletor usa o mesmo modelo tipado da biblioteca e envia o ID escolhido no payload de criação do estudo. A adequação do endpoint e do serviço de estudos ao DER continua fora deste CRUD.

## Organização e consultas

A criação usa uma única operação de inserção; o PATCH usa uma única operação de atualização com retorno do registro. A chave estrangeira de `id_usuario` é a validação definitiva e a violação `23503` é convertida em HTTP 400. Isso dispensa consultas preliminares e a duplicação da validação genérica de existência. A ausência de registro no retorno da atualização gera HTTP 404. A exclusão permanece protegida pelas referências do banco, com HTTP 409.

## Validação

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/InstallCriterionValidation.test.ts
```

Os testes exercitam as rotas Fastify com o pool PostgreSQL simulado, sem conectar ao banco.

## Validação semântica das restrições (14/10/2026)

As rotas de criação e edição retornam HTTP 400 para restrições inválidas antes de gravar:

- `relevo`, `vegetacoes`, `edificacoes` e `antenas` devem ser objetos ou `null`.
- Campos numéricos conhecidos devem conter números finitos, não strings. Distâncias, raios e altura de edificações não podem ser negativos. Altitudes podem ser negativas.
- Altitude mínima não pode ultrapassar a máxima quando ambas forem informadas. Declividade: 0 a 90 graus.
- Quantidades: inteiros positivos até 2147483647, conforme a validação já utilizada no formulário.
- Indicador de conflito de frequência: booleano ou `null`.
- Vegetação permitida/proibida: listas de textos não vazios ou `null`, sem interseção após normalização de caixa/acentos.
- Listas de tipos de ativos não podem se contradizer. POSTES e SUBESTACOES são normalizados para POSTE e SUBESTACAO. Tipos fora do catálogo das camadas são rejeitados.

O PATCH mantém sua semântica: campo de primeiro nível omitido é preservado; seção JSONB enviada substitui a seção inteira (não é mesclagem recursiva). As regras internas são aplicadas à seção enviada. Na alteração de qualquer lista de ativos, o serviço lê a outra lista com `SELECT FOR UPDATE` e grava na mesma transação. Alterações concorrentes não conseguem introduzir um conflito entre as listas.

Compatibilidade: propriedades extras das seções avançadas são preservadas. Objetos e códigos desconhecidos nas listas de ativos são rejeitados em novas gravações. Registros antigos não são apagados automaticamente; o formulário oferece remoção explícita das regras antigas.

Frontend: mostra o erro sem descartar o formulário e impede envio de intervalos/conflitos identificados localmente. A API permanece responsável pela validação de chamadas externas.


### Intervalo de distância aos ativos

POST e PATCH aceitam os dois limites em metros. Exemplo: `{"distancia_minima_ativos_m":100,"distancia_maxima_ativos_m":300}`.
Omissão em PATCH preserva o limite anterior; `null` remove somente esse limite. A API valida o par enviado e a constraint `criterios_instalacao_distancias_validas` valida o resultado persistido de atualizações parciais, retornando HTTP 400 em caso de intervalo invertido. Registros antigos podem manter mínima nula. Nenhuma atualização em AWS foi executada.

## Catálogo de regras elétricas

O catálogo é compartilhado com a API de ativos em `src/interface/AssetType.ts`: POSTE, TRANSFORMADOR, SUBESTACAO, DISPOSITIVO, CHAVE_FUSIVEL, CHAVE_SECCIONADORA, RELIGADOR, SECCIONADOR_AUTOMATICO, REGULADOR_TENSAO e BANCO_CAPACITORES.

Permitido e Bloqueado são listas mutuamente exclusivas. Neutro significa ausência nas duas listas e é o padrão do novo formulário. Tipos personalizados não são aceitos.

## Preparação do PostgreSQL

Consulte [o guia do banco](../database/README.md) para criação em banco vazio,
verificação somente de leitura e aplicação das migrations em bancos existentes.
A migration 006 acrescenta `criterios_instalacao_distancias_faixa`, que garante
10–500 m também em SQL direto; a API traduz sua violação para HTTP 400.
Não foi executada automaticamente em nenhum ambiente.
