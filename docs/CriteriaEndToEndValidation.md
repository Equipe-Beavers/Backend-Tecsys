# Validação de critérios: frontend, API e banco local

Validação realizada em 13/10/2026. Nenhuma conexão com AWS ou Supabase.

## Evidência

O teste opt-in `frontend/test/criteria_local_e2e_test.dart` instancia os widgets reais da biblioteca e do formulário, usa o serviço HTTP real em `127.0.0.1:3001` e consulta diretamente o PostgreSQL por `scripts/InspectCriterionLocal.mjs`. Não usa respostas HTTP simuladas.

Foi verificado:

- Criação pela interface com nome exclusivo, altitude mínima de 300 m, raio de edificações de 100 m e raio de antenas de 500 m.
- Persistência desses valores, vegetação, alimentação elétrica e distância máxima no banco.
- Remontagem da biblioteca e leitura do registro pela API.
- Edição pela interface, atualização da data e preservação de vegetação.
- Exclusão pela interface e confirmação de ausência no banco.
- Limpeza dos registros deste teste em caso de falha.

Resultado: teste passou. Trata-se de integração dos widgets com HTTP e banco reais; não é automação de Chrome. Não verifica CORS do navegador nem fidelidade visual, menu lateral ou todas as combinações de regras.

## Como repetir

Na pasta `backend`, com `.env.local` configurado:

```bash
npm run db:local:up
npm run dev:local
```

Em outro terminal, na pasta `frontend`:

```bash
flutter test test/criteria_local_e2e_test.dart --dart-define=TEST_CRITERIA_LOCAL=true
```

O teste usa o usuário fictício 1 e a biblioteca local com poucos registros. Sem a flag, fica ignorado na suíte comum e não acessa o banco. O helper de inspeção é somente leitura e carrega a proteção de ambiente local antes de criar o pool.

## Avaliação de novo_schema.sql

O modelo de `criterios_instalacao` em `novo_schema.sql` corresponde às colunas consumidas atualmente pela API e pelo frontend, incluindo `relevo`, `vegetacoes`, `edificacoes` e `antenas` em JSONB. É uma base coerente para o CRUD atual, mas não garante que todos os requisitos da PO foram implementados.

O banco local observado contém também `locais_autorizados`, `locais_obrigatorios` e `locais_proibidos`. Essas colunas antigas não são utilizadas no CRUD atual. Não foram removidas nesta verificação.

Pendências:

1. O RangeSlider solicitado pela PO exige distância mínima e máxima. Atualmente formulário, API e novo schema mantêm apenas `distancia_maxima_ativos_m`.
2. O protótipo de antenas mostra distância mínima; o formulário/payload atual usa `distancia_maxima_m`. É necessário alinhar essa semântica antes de usar as regras em cálculos.
3. JSONB não define sozinho o formato interno. Em 14/10/2026 foram adicionadas validações de tipos, limites, intervalos e conflitos na API e no formulário. Propriedades extras são preservadas por compatibilidade; seleções históricas de ativos em objetos opacos não têm conflitos inferidos. Consulte InstallCriteriaApi.md.
4. `novo_schema.sql` exige PostGIS previamente habilitado e não é uma migração para um banco já existente.
5. O Compose ainda inicializa pelo DER original e pelas migrações. Scripts de inicialização só rodam automaticamente em volumes vazios. A escolha de um schema oficial deve ser alinhada pelo grupo; este teste não troca o schema nem recria o banco.

Não é necessário mudar o CRUD apenas para apontar a uma base criada pelo novo schema: as colunas de critérios já correspondem. Para migrar dados existentes, utilizar migrações revisadas, preservando os dados antigos antes de qualquer remoção.
