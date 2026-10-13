# Backend Tecsys

API backend do projeto Tecsys, desenvolvida em TypeScript com Fastify e PostgreSQL.

## Pré-requisitos

- Node.js instalado, preferencialmente versão 20 ou superior;
- npm;
- um projeto no Supabase ou uma instalação local do PostgreSQL;
- credenciais de acesso ao banco de dados.

## Como rodar do zero

### 1. Clonar o repositório

```bash
git clone https://github.com/Equipe-Beavers/Backend-Tecsys.git
cd Backend-Tecsys
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Criar o banco de dados

O schema das tabelas está no arquivo [`database/schema.sql`](database/schema.sql). Ele cria a extensão PostGIS, as tabelas, os relacionamentos e os índices necessários.

O schema não inclui as tabelas `distribuidoras` e `posicoes_geograficas`, usadas pelos endpoints de regiões para consultar o dataset BDGD. Essas tabelas e seus dados devem ser importados separadamente no banco escolhido.

#### Opção A: Supabase

1. Crie ou abra um projeto em [supabase.com](https://supabase.com/).
2. No painel do projeto, acesse **SQL Editor** e crie uma nova query.
3. Copie o conteúdo de [`database/schema.sql`](database/schema.sql), cole na query e clique em **Run**.
4. Confirme em **Table Editor** se as tabelas foram criadas.

Para obter os dados da conexão PostgreSQL, acesse **Connect** no projeto Supabase e escolha o método de conexão recomendado para sua rede. Serão necessários host, porta, nome do banco, usuário e senha.

#### Opção B: PostgreSQL local

1. Instale o PostgreSQL com a extensão PostGIS.
2. Crie um banco, por exemplo `tecsys_data`.
3. Execute o schema usando `psql`:

```bash
psql -U postgres -d tecsys_data -f database/schema.sql
```

Se o PostGIS não estiver instalado, a criação das colunas `GEOMETRY` falhará. Instale o pacote PostGIS compatível com sua versão do PostgreSQL antes de executar o arquivo.

### 4. Configurar as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto. Para usar o PostgreSQL local, utilize:

```env
DB_NAME=tecsys_data
DB_USER=postgres
DB_PASSWORD=sua_senha_do_postgres
DB_HOST=localhost
DB_PORT=5432
DB_SSL=false
PORT=3000
```

Para usar o banco PostgreSQL do Supabase, substitua `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` e `DB_PORT` pelos valores exibidos em **Connect** e use SSL:

```env
DB_NAME=postgres
DB_USER=postgres.seu_project_ref
DB_PASSWORD=sua_senha_do_supabase
DB_HOST=seu_host_do_supabase
DB_PORT=5432
DB_SSL=true
PORT=3000
```

O módulo de regiões também usa o SDK do Supabase. Inclua no `.env` os valores de **Project URL** e **service_role key**, encontrados em **Project Settings > API**:

```env
SUPABASE_URL=https://seu_project_ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

As variáveis obrigatórias para a conexão PostgreSQL são `DB_NAME`, `DB_USER` e `DB_PASSWORD`. Para as consultas que usam o SDK, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` também são obrigatórias. Nunca publique o arquivo `.env` nem a `service_role key` no GitHub.

`DB_HOST`, `DB_PORT`, `DB_SSL` e `PORT` são opcionais e assumem, respectivamente, `localhost`, `5432`, `false` e `3000`.

### 5. Iniciar em modo de desenvolvimento

```bash
npm run dev
```

O servidor ficará disponível em `http://localhost:3000` e será reiniciado automaticamente quando os arquivos TypeScript forem alterados.
## Edificações no cálculo de propagação

As edificações vêm da [Overture Maps](https://docs.overturemaps.org/guides/buildings/) (tema `buildings`, licença ODbL), consultadas **sob demanda** pelo backend. Nada é importado nem gravado no banco: os dados ficam só num cache em memória, com validade e limite de tamanho, e somem quando o servidor reinicia.

- O catálogo STAC da Overture informa o retângulo de cada arquivo GeoParquet; só os arquivos que tocam a região são lidos (DuckDB em memória). A primeira consulta de uma região leva de 20 a 50 s; as seguintes usam o cache.
- **Geometria, largura, profundidade e área**: sempre calculadas a partir do contorno (retângulo mínimo).
- **Altura**: `height` da fonte → `num_floors` × 3 m → `BUILDING_DEFAULT_FLOORS` × 3 m (6 m por padrão). O campo `origem_altura` indica qual regra foi usada (`INFORMADA`, `PAVIMENTOS`, `PADRAO`).
- **Material**: `facade_material` da fonte quando existe; senão **cimento** (`CIMENTO`), o padrão do projeto. O campo `origem_material` indica `INFORMADO` ou `PADRAO`.
- Se a fonte estiver fora do ar, `GET /list-buildings` responde 503, e a mancha/recomendação segue sem as edificações, informando o motivo em `buildings_error`.

| Rota | Descrição |
| --- | --- |
| `GET /list-buildings` | Edificações de um retângulo (máx. 0,1° de lado). `format=geojson` devolve uma FeatureCollection. |
| `GET /list-building-materials` | Materiais e perda por parede (900/2400 MHz). |
| `POST /calculate-building-obstruction` | Edificações cruzadas por enlaces e a perda extra de cada um. |
| `POST /generate-coverage` | Mancha de cobertura de um gateway com as edificações. |

Variáveis opcionais: `OVERTURE_RELEASE`, `BUILDINGS_QUERY_TIMEOUT_MS`, `BUILDINGS_CACHE_TTL_MIN`, `BUILDINGS_CACHE_MAX`, `BUILDING_DEFAULT_FLOORS`, `BUILDINGS_MAX_RADIUS_M` (veja `.env.example`).
