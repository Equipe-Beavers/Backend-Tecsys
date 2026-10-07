import assert from 'node:assert/strict';
import { LocalEnvironment } from './LocalEnvironment.mjs';
LocalEnvironment.Load();

// Dynamic imports ensure the guarded local profile is loaded before database clients.
const { App } = await import('../src/app.ts');
const { pool, closePool } = await import('../src/database/pool.ts');
const { getInstallCriterionQuery } = await import('../src/database/queries.ts');
const app = new App().getInstance();
app.log.level = 'silent';
const createdIds = new Set();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

try {
  const list = await app.inject('/list-install-criteria?id_usuario=1&page=1&limit=20');
  assert.equal(list.statusCode, 200, list.body);
  check(list.json().data.some((row) => row.id_criterio_instalacao === 3), 'Seed de critério em uso');

  const payload = {
    id_usuario: 1, nome: " [TESTE AUTOMÁTICO] d'instalação; -- ",
    tipos_elementos_permitidos: ['POSTE', 'TORRE'], tipos_elementos_proibidos: { custom: ['x'] },
    requer_alimentacao_eletrica: false, distancia_maxima_ativos_m: 1234.56,
    locais_autorizados: { ids: ['A'] }, locais_obrigatorios: [], locais_proibidos: null,
    limite_gateways: 3,
  };
  const create = await app.inject({ method: 'POST', url: '/create-install-criterion', payload });
  assert.equal(create.statusCode, 201, create.body);
  const criterion = create.json().data;
  createdIds.add(criterion.id_criterio_instalacao);
  check(typeof criterion.id_criterio_instalacao === 'number' && typeof criterion.id_usuario === 'number', 'IDs numéricos compatíveis com o frontend');
  check(criterion.nome === payload.nome.trim(), 'Nome com apóstrofo preservado por parâmetros SQL');
  check(criterion.distancia_maxima_ativos_m === 1234.56 && criterion.requer_alimentacao_eletrica === false, 'Decimal e false preservados');
  check(typeof criterion.criado_em === 'string' && criterion.atualizado_em === null, 'Datas geradas pelo PostgreSQL');
  assert.deepEqual(criterion.tipos_elementos_proibidos, payload.tipos_elementos_proibidos); checks++;

  const get = await app.inject(`/get-install-criterion/${criterion.id_criterio_instalacao}`);
  assert.equal(get.statusCode, 200, get.body);
  assert.deepEqual(get.json().data, criterion); checks++;
  const persisted = await pool.query(getInstallCriterionQuery, [criterion.id_criterio_instalacao]);
  check(persisted.rows.length === 1 && Number(persisted.rows[0].distancia_maxima_ativos_m) === 1234.56, 'Persistência real local');

  const patch = await app.inject({ method: 'PATCH', url: `/update-install-criterion/${criterion.id_criterio_instalacao}`,
    payload: { nome: '[TESTE AUTOMÁTICO] Revisado', distancia_maxima_ativos_m: 0, limite_gateways: null, locais_autorizados: null } });
  assert.equal(patch.statusCode, 200, patch.body);
  const updated = patch.json().data;
  check(updated.distancia_maxima_ativos_m === 0 && updated.limite_gateways === null && updated.locais_autorizados === null, 'PATCH aceita zero e limpa opcionais');
  assert.deepEqual(updated.tipos_elementos_proibidos, payload.tipos_elementos_proibidos); checks++;
  check(updated.requer_alimentacao_eletrica === false && typeof updated.atualizado_em === 'string', 'PATCH preserva omitidos e atualiza data');

  const invalidUser = await app.inject({ method: 'POST', url: '/create-install-criterion', payload: { id_usuario: 9007199254740991, nome: 'Usuário inexistente' } });
  check(invalidUser.statusCode === 400, 'FK de usuário no INSERT retorna 400');
  const invalidPatch = await app.inject({ method: 'PATCH', url: `/update-install-criterion/${criterion.id_criterio_instalacao}`, payload: { id_usuario: 9007199254740991 } });
  check(invalidPatch.statusCode === 400, 'FK de usuário no UPDATE retorna 400');
  const afterFailure = await app.inject(`/get-install-criterion/${criterion.id_criterio_instalacao}`);
  check(afterFailure.json().data.id_usuario === 1, 'Atualização inválida não altera registro');

  const otherUser = await app.inject('/list-install-criteria?id_usuario=2');
  check(otherUser.json().data.every((row) => row.id_usuario === 2), 'Filtro por usuário');
  const first = await app.inject('/list-install-criteria?id_usuario=1&page=1&limit=1');
  const second = await app.inject('/list-install-criteria?id_usuario=1&page=2&limit=1');
  check(first.json().data.length === 1 && second.json().data.length === 1 && first.json().data[0].id_criterio_instalacao !== second.json().data[0].id_criterio_instalacao, 'Paginação SQL');

  const referenced = await app.inject({ method: 'DELETE', url: '/delete-install-criterion/3' });
  check(referenced.statusCode === 409, 'Critério referenciado por estudo não pode ser excluído');
  const remove = await app.inject({ method: 'DELETE', url: `/delete-install-criterion/${criterion.id_criterio_instalacao}` });
  check(remove.statusCode === 204 && remove.body === '', 'DELETE sem corpo');
  createdIds.delete(criterion.id_criterio_instalacao);
  const missing = await app.inject(`/get-install-criterion/${criterion.id_criterio_instalacao}`);
  check(missing.statusCode === 404, 'GET após exclusão retorna 404');
  const minimal = await app.inject({ method: 'POST', url: '/create-install-criterion', payload: { id_usuario: 1, nome: '[TESTE AUTOMÁTICO] Mínimo' } });
  assert.equal(minimal.statusCode, 201, minimal.body);
  createdIds.add(minimal.json().data.id_criterio_instalacao);
  check(minimal.json().data.limite_gateways === null && minimal.json().data.tipos_elementos_permitidos === null, 'Opcionais omitidos persistidos como NULL');

  const { supabase } = await import('../src/database/supabase.ts');
  assert.throws(() => supabase.from('usuarios'), /Supabase desativado/); checks++;
  console.log(`${checks} verificações de integração passaram no PostgreSQL local.`);
} finally {
  for (const id of createdIds) {
    const response = await app.inject({ method: 'DELETE', url: `/delete-install-criterion/${id}` });
    if (response.statusCode !== 204) console.error(`Não foi possível remover o registro temporário ${id}.`);
  }
  await app.close();
  await closePool();
}
