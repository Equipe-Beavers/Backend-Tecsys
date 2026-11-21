# Remoção de custos — itens de Francisco, sprint 3

A migração `20261118_francisco_remove_costs.sql` remove `cenarios.custo_total_estimado`, `cenario_gateways.custo_estimado` e `perfis_rf.custo_estimado_gateway`. Os dados são arquivados em `migration_backups.francisco_sprint3_costs`, separados das tabelas da aplicação.

Execute uma única vez, em conjunto com a versão que removeu custos do frontend e backend. A transação falha sem remoções parciais se não conseguir os bloqueios em cinco segundos. Não usa `CASCADE`. Não reaplique `database/schema.sql` a uma base existente.

A reversão está em `20261118_francisco_restore_costs.sql`: restaura as três colunas e seus valores anteriores. Reverta também os fontes para a versão compatível. Registros criados depois da remoção ficam com custo nulo na reversão.

A migração e a reversão foram verificadas num PostgreSQL temporário com dados conhecidos. O campo legado `criterios_instalacao.custo_maximo`, que não participa dos custos do resultado, não faz parte desta migração.
