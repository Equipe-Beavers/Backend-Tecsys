# Banco de dados — entrega de critérios de instalação

Para executar a aplicação, comece pelo [passo a passo dos critérios](../docs/RunInstallCriteria.md).
Este documento detalha a estrutura e as atualizações do banco.

Este guia cobre a persistência do CRUD de critérios. O ambiente segue o padrão
PG local do time e o `.env` existente. Não exige Docker, `.env.local`, porta
especial ou credenciais compartilhadas. A adoção de um schema oficial para todos
os módulos deve ser alinhada com o grupo.

## Qual arquivo usar

| Arquivo | Finalidade |
| --- | --- |
| `../novo_schema.sql` | Referência consolidada atual dos critérios, dentro do modelo completo. Somente para banco vazio; não é atualização de banco existente. |
| `../../DER - Geomash.sql` | Modelo anterior, mantido na raiz como referência histórica. Não contém todas as colunas atuais dos critérios. |
| `schema.sql` | Arquivo legado: **não utilizar para esta entrega**. Não foi substituído sem alinhamento com os responsáveis pelos outros módulos. |
| `migrations/` | Atualizações incrementais revisáveis para bancos existentes. |
| `checks/install-criteria.sql` | Diagnóstico de estrutura somente de leitura; não altera dados e não atesta conectividade do frontend. |
| `../.env.example` | Exemplo sem credenciais reais; não aponta automaticamente ao banco de ninguém. |

Os arquivos SQL não são executados por `npm run dev`. A inicialização também não
cria usuários, não popula registros e não aplica migrations.

## Configurar a conexão

Se ainda não houver `.env`, use `.env.example` como referência. Se já houver,
**edite somente os valores necessários**, preservando as configurações dos outros
módulos. Não copie o exemplo por cima do arquivo existente.

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL escolhido.
- `DB_SSL`: TLS (`false` normalmente no ambiente local).
- `PORT`: porta HTTP da API, padrão 3000; não é a porta do PostgreSQL.
- `DISABLE_SUPABASE=true`: permite trabalhar com os módulos PostgreSQL sem SDK
  Supabase. Se precisar de módulos Supabase, use a configuração correspondente
  do time; essa opção os desativa.

O backend carrega `.env`; variáveis já exportadas no terminal podem ter precedência
sobre o arquivo. Confira o destino antes de iniciar. Nenhuma alteração deste guia
exige publicar `.env`, senhas, dumps ou dados reais.

## Quem está criando um banco vazio

1. Prepare PostgreSQL com PostGIS disponível e crie um banco vazio com o usuário
   local que você utiliza. O schema completo usa dados geográficos.
2. Revise `../novo_schema.sql` com os responsáveis pelo banco e aplique-o nesse
   banco vazio. O script habilita PostGIS; o usuário precisa de permissão para isso.
3. Providencie um usuário de teste em `usuarios`, seguindo o cadastro do projeto.
   O `APP_USER_ID` do frontend precisa corresponder a um usuário existente.
4. Execute a verificação abaixo e inicie o backend com `npm run dev`.

Não reaplique o schema completo sobre um banco que já tenha tabelas.

## Quem já possui banco com o DER anterior

Na pasta `backend`, use o comando abaixo substituindo host, porta, usuário e banco
pelos valores locais. `psql` solicita a senha se necessário; não a coloque no comando.
Ele **não carrega o arquivo `.env`** automaticamente.

```bash
psql -h localhost -p 5432 -U SEU_USUARIO -d SEU_BANCO -v ON_ERROR_STOP=1 -f database/checks/install-criteria.sql
```

Revise os resultados e aplique somente as migrations pendentes:

| Ordem | Migration | Efeito e pré-requisito |
| --- | --- | --- |
| 003 | `003-install-criterion-min-distance.sql` | Adiciona distância mínima e CHECK mínima ≤ máxima. Requer a tabela de critérios existente. |
| 004 | `004-remove-installation-locations.sql` | **Destrutiva:** remove três colunas antigas e seus dados. Opcional para funcionamento do CRUD atual; exige revisão e preservação dos dados necessários. |
| 005 | `005-install-criterion-json-sections.sql` | Acrescenta relevo, vegetações, edificações e antenas. |
| 006 | `006-install-criterion-distance-range.sql` | Garante 10–500 m para limites não nulos. Requer 003 e dados compatíveis; falha sem converter valores antigos. |

Exemplo para uma migration confirmada como pendente:

```bash
psql -h localhost -p 5432 -U SEU_USUARIO -d SEU_BANCO -v ON_ERROR_STOP=1 -f database/migrations/006-install-criterion-distance-range.sql
```

Antes de 006, após as colunas de distância existirem, esta consulta identifica
registros que precisam de revisão (não os altera):

```sql
SELECT id_criterio_instalacao, distancia_minima_ativos_m, distancia_maxima_ativos_m
FROM criterios_instalacao
WHERE distancia_minima_ativos_m NOT BETWEEN 10 AND 500
   OR distancia_maxima_ativos_m NOT BETWEEN 10 AND 500
   OR distancia_minima_ativos_m > distancia_maxima_ativos_m;
```

Defina os valores corretos com os responsáveis pelos registros; não use ajustes
em massa que inventem novos limites. Não é necessário excluir critérios antigos.

## Como interpretar a verificação

- Nenhuma das 15 colunas exigidas deve aparecer como `AUSENTE` ou `REVISAR`.
- Confira `nome` com tamanho 150, distâncias `numeric(12,2)`, ID gerado pelo banco
  e `criado_em` com padrão `CURRENT_TIMESTAMP` (ou equivalente `now()`).
- Confira PK, FK de `id_usuario` para `usuarios` e os dois CHECKs de distância.
- Quando estudos estiverem integrados, a FK de estudos deve impedir excluir um
  critério referenciado, sem cascata. O backend retorna HTTP 409 nessa situação.
- Confira índice de `id_usuario` em critérios e de `id_criterio_instalacao` em estudos.
- Colunas legadas ainda presentes não impedem o CRUD; sua remoção é a etapa 004.

O relatório é diagnóstico, não um runner de migrations. A existência de uma
constraint com o nome esperado não comprova que sua definição está correta;
confira a definição e se está validada.

## Contrato que o banco atende

Nome, alimentação, limites de distância e máximo de gateways têm colunas próprias.
Tipos permitidos/proibidos são listas JSONB de códigos do catálogo elétrico;
Neutro corresponde à ausência em ambas. Relevo, vegetação, edificações e antenas
usam objetos JSONB. Não é necessário cadastrar ativos físicos para salvar regras.

A API valida os tipos do catálogo, conflitos entre listas, quantidades, declividade
e o formato conhecido das seções JSONB. Essas regras não estão todas replicadas
em CHECKs do banco. A migration 006 reforça especificamente a faixa de distância.

## Verificação da entrega e histórico de aplicação

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/InstallCriterionValidation.test.ts
```

Esses testes usam conexão simulada. Para validar persistência real, no ambiente
local configurado: crie um critério pelo frontend, recarregue, edite, confira o
registro no PostgreSQL e exclua o registro de teste. Inclua distância 10–500 m e
as três opções de ativos. Verifique também a proteção de exclusão em uso, se houver
um estudo de teste. Não execute esse roteiro em dados reais por engano.

No PR, registre: migrations necessárias, quais foram aplicadas no seu ambiente,
resultado da verificação e limitações. Não declare aplicação em AWS por ter testado
localmente. Não altere migrations antigas para representar mudanças novas.

Ainda não existe um runner nem uma tabela de histórico de migrations neste fluxo.
Até o time escolher um mecanismo comum, registre a execução por ambiente e confira
a estrutura antes de aplicar; a numeração dos arquivos não prova que foram executados.
Não foi introduzido outro fluxo de inicialização para os colegas.
