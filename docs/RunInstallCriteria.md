# Como rodar e testar os critérios de instalação

Este é o ponto de partida para executar **Biblioteca → Critérios**.
O fluxo é: **Flutter → API Node.js → PostgreSQL local do time**.
Não é necessário Supabase, Docker específico dos critérios ou `.env.local`.

## 1. Preparar o ambiente — primeira vez

Você precisa de Node.js/npm, Flutter compatível com o `pubspec.yaml` do frontend,
Chrome ou dispositivo Android e PostgreSQL local acessível. Para criar o modelo
completo, o PostgreSQL também precisa ter PostGIS disponível.

### Configurar o backend

Abra um terminal na pasta `backend`:

```bash
npm install
```

Use [`.env.example`](../.env.example) como referência. Se já existe `.env`, edite-o;
não copie o exemplo por cima dele. Preencha com **o seu PostgreSQL local**:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=SEU_BANCO_LOCAL
DB_USER=SEU_USUARIO
DB_PASSWORD=SUA_SENHA_LOCAL
DB_SSL=false
PORT=3000
API_HOST=0.0.0.0
DISABLE_SUPABASE=true
```

Os valores em maiúsculas acima são exemplos para substituir. `DISABLE_SUPABASE=true`
serve para trabalhar nos módulos PostgreSQL; outros módulos dependentes de Supabase
ficam indisponíveis. Não publique o `.env` no Git.

**Não confunda as portas:** `5432` é do banco; `3000` é da API e será usada pelo Flutter.
O backend lê `.env`, não `.env.local`. Variáveis exportadas no terminal podem ter
precedência sobre `.env`; confira isso se a conexão apontar para outro destino.

### Preparar as tabelas

Escolha o caso correspondente ao seu banco:

| Situação | O que fazer |
| --- | --- |
| Banco vazio e modelo completo aprovado pelo time | Aplicar `backend/novo_schema.sql` no banco vazio. |
| Banco com a tabela `criterios_instalacao` antiga | Verificar a estrutura e aplicar somente as migrations pendentes. |
| Banco com ativos, mas sem `usuarios` e/ou `criterios_instalacao` | Executar no editor SQL somente as definições das tabelas ausentes de `novo_schema.sql`, começando por `usuarios`, e o índice `idx_criterios_instalacao_usuario` se estiver ausente. Não executar o arquivo completo. |
| Banco já atualizado | Apenas verificar a estrutura e seguir para o usuário de teste. |

Para **banco vazio**, na pasta `backend`, substitua os parâmetros:

```bash
psql -h localhost -p 5432 -U SEU_USUARIO -d SEU_BANCO_LOCAL -v ON_ERROR_STOP=1 -f novo_schema.sql
```

Para verificar qualquer banco, também na pasta `backend`:

```bash
psql -h localhost -p 5432 -U SEU_USUARIO -d SEU_BANCO_LOCAL -v ON_ERROR_STOP=1 -f database/checks/install-criteria.sql
```

O `psql` não lê `.env`; informe o mesmo destino configurado nele. Você também pode
abrir os SQLs no DBeaver ou pgAdmin conectado a esse banco.

A verificação deve mostrar as 15 colunas dos critérios sem `AUSENTE` ou `REVISAR`.
Confira também as definições das constraints. O diagnóstico não aplica correções.

As migrations **003, 005 e 006** completam os campos e as constraints de distância
em bancos com a tabela antiga. A **004 remove colunas e dados antigos** e não é
necessária para o CRUD funcionar. Consulte [o guia do banco](../database/README.md)
antes de aplicar qualquer migration. Não use `database/schema.sql`, que é legado.

### Ter um usuário válido

O critério precisa referenciar um registro existente em `usuarios`.
Consulte no seu PostgreSQL local:

```sql
SELECT id_usuario, username FROM usuarios ORDER BY id_usuario;
```

Se não houver usuário, você pode criar este registro fictício **somente para testar
os critérios localmente**:

```sql
INSERT INTO usuarios (username, email, senha_hash)
VALUES ('teste_criterios', 'teste_criterios@example.invalid', 'REGISTRO_LOCAL_SEM_LOGIN')
ON CONFLICT (username) DO NOTHING;

SELECT id_usuario FROM usuarios WHERE username = 'teste_criterios';
```

Esse registro não possui uma senha válida para login. Ele atende apenas ao vínculo
exigido pelo CRUD. Anote o ID retornado; **não presuma que será 1**.
`APP_USER_ID` é uma configuração de desenvolvimento, não autenticação.

## 2. Iniciar — uso diário

Depois da preparação, mantenha dois terminais abertos.

### Terminal 1: backend

Na pasta `backend`:

```bash
npm run dev
```

O PostgreSQL precisa estar rodando. O comando não cria tabelas nem aplica migrations.
Não use os antigos comandos `dev:local`, `db:local:up` ou `test:criteria:local`;
eles foram removidos para seguir o padrão do time.

### Terminal 2: frontend

Na pasta `frontend`:

```bash
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000 --dart-define=APP_USER_ID=SEU_ID
```

Substitua `SEU_ID` pelo número do usuário consultado no banco, sem aspas.
Se alterou `PORT`, use essa mesma porta em `API_BASE_URL`.
Depois de alterar um `--dart-define`, encerre e execute novamente o Flutter.

### Android

Use `flutter devices` para descobrir o identificador do dispositivo.

| Onde está rodando o app | Endereço da API |
| --- | --- |
| Chrome no mesmo computador | `http://localhost:3000` |
| Emulador Android padrão | `http://10.0.2.2:3000` |
| Celular físico na mesma rede | `http://IP_DO_COMPUTADOR:3000` |

```bash
flutter run -d ID_DO_DISPOSITIVO --dart-define=API_BASE_URL=http://IP_DO_COMPUTADOR:3000 --dart-define=APP_USER_ID=SEU_ID
```

No celular físico, `localhost` é o próprio celular. Use o IP da rede local do
computador, não o IP de uma bridge Docker. A rede precisa permitir a comunicação
com a porta da API. O celular acessa a API, nunca a porta do PostgreSQL.

## 3. Conferir se está funcionando

1. Abra **Biblioteca → Critérios**. Uma biblioteca vazia é normal sem registros;
   a mensagem “Não foi possível carregar” indica falha e deve ser investigada.
2. Crie um critério com um nome fácil de identificar, como `Teste manual critérios`.
3. Marque um tipo como Permitido e outro como Bloqueado. Os demais ficam Neutros.
4. Escolha distância entre **10 e 500 m** e preencha algumas restrições de relevo,
   vegetação, edificações e antenas. Salve.
5. Recarregue a aplicação e abra o critério para conferir os valores recuperados.
6. Edite o nome, a distância e uma regra de ativo. Salve e reabra.
7. Confira a persistência no seu editor SQL:

```sql
SELECT id_criterio_instalacao, id_usuario, nome,
       tipos_elementos_permitidos, tipos_elementos_proibidos,
       distancia_minima_ativos_m, distancia_maxima_ativos_m,
       relevo, vegetacoes, edificacoes, antenas, atualizado_em
FROM criterios_instalacao
WHERE nome = 'Teste manual critérios';
```

Use o nome atualizado no filtro se você o alterou. Depois, exclua o critério pela
interface e confirme que ele não aparece mais na consulta. Critérios vinculados
a estudos não podem ser excluídos; a API retorna HTTP 409.

## 4. Resolver problemas comuns

| Sintoma | Verificação |
| --- | --- |
| Não foi possível carregar | API iniciada, `API_BASE_URL` correto e PostgreSQL disponível. Consulte também o terminal do backend. |
| `ECONNREFUSED` no backend | Confira host/porta do banco e se ele está rodando. |
| Falha de senha do PostgreSQL | Confira `DB_USER`/`DB_PASSWORD` no `.env` e variáveis exportadas no terminal. |
| Relação ou coluna inexistente | Execute o diagnóstico e revise as migrations necessárias. |
| Usuário não encontrado ao salvar | O `APP_USER_ID` precisa existir em `usuarios` no mesmo banco da API. |
| Exigência de configuração Supabase | Para testar só critérios, confira `DISABLE_SUPABASE=true` no `.env`. |
| Distância antiga fora da faixa | Ajuste o registro para 10–500 m; a migration 006 não converte valores automaticamente. |
| Funciona no computador, falha no celular | Confira IP local, rede, firewall e `API_HOST`. |
| CORS no navegador | Confira a origem. Para outras origens além de localhost/127.0.0.1, configure `CORS_ORIGINS` no backend. |

## 5. Testes automatizados

Na pasta `backend`:

```bash
npm run build
npm test -- test/InstallCriterion.test.ts test/InstallCriterionValidation.test.ts
```

Na pasta `frontend`:

```bash
flutter analyze
flutter test
```

Esses comandos não atestam a conexão com seu PostgreSQL: os testes regulares usam
substitutos controlados para HTTP/banco. Use o roteiro manual da seção 3 para
confirmar a integração no seu ambiente.

## Referências e validação realizada

- [Banco: arquivos, migrations e interpretação do diagnóstico](../database/README.md)
- [Contrato da API](InstallCriteriaApi.md)
- [Interface e campos](../../frontend/docs/InstallCriteriaInterface.md) — caminho do projeto com os dois submódulos.

Em 16/10/2026: build aprovado, 87 testes de backend dos critérios e 50 testes do
frontend passaram; análise Flutter sem problemas. Um teste temporário de widgets
usou API e PostgreSQL reais para criar, recarregar, editar e excluir critérios.
O schema completo e as migrations foram verificados em transações revertidas.
Isso não representa teste manual em navegador ou celular físico.

Nesse ambiente de validação, `Tecsys_Data` em `127.0.0.1:5432` recebeu somente as
tabelas ausentes `usuarios` e `criterios_instalacao` e o índice dos critérios.
Os registros temporários foram removidos e a API temporária foi encerrada.
Nenhuma credencial `.env` foi alterada. Esses detalhes são um registro da validação,
não valores obrigatórios para os computadores dos colegas.
