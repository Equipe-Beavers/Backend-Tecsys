import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';
import { InstallCriterionValidation } from '../src/utils/InstallCriterionValidation.js';
import { lockInstallCriterionQuery, updateInstallCriterionQuery } from '../src/database/queries.js';
const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), release: vi.fn() }));
vi.mock('../src/database/pool.js', () => ({ pool: db }));
vi.mock('../src/database/supabase.js', () => ({ supabase: {} }));
const invalid = [
  { relevo: [] },
  { relevo: { altitude_minima_m: 500, altitude_maxima_m: 100 } },
  { relevo: { declividade_maxima_graus: 91 } },
  { relevo: { altitude_minima_m: '300' } },
  { vegetacoes: { permitidas: ['Mangue'], proibidas: ['MANGUE'] } },
  { vegetacoes: { permitidas: 'MANGUE' } },
  { vegetacoes: { permitidas: [' '] } },
  { edificacoes: { quantidade_maxima: 1.5 } },
  { edificacoes: { quantidade_maxima: 2147483648 } },
  { edificacoes: { altura_maxima_m: -1 } },
  { antenas: { raio_analise_m: -1 } },
  { antenas: { considerar_conflito_frequencia: 'false' } },
  { tipos_elementos_permitidos: ['TORRE'], tipos_elementos_proibidos: ['Torres'] },
  { tipos_elementos_permitidos: ['Subestação'], tipos_elementos_proibidos: ['SUBESTACOES'] },
];
describe('Criteria semantic validation', () => {
  let app: ReturnType<App['getInstance']>;
  beforeEach(() => { vi.resetAllMocks(); app = new App().getInstance(); app.log.level = 'silent'; db.connect.mockResolvedValue(db); });
  afterEach(async () => { await app.close(); });
  it.each(invalid)('rejects invalid JSON before persistence: %j', async (fields) => {
    for (const method of ['POST', 'PATCH'] as const) {
      const response = await app.inject({method, url: method === 'POST' ? '/create-install-criterion' : '/update-install-criterion/7',
        payload: method === 'POST' ? {id_usuario: 1, nome: 'Teste', ...fields} : fields});
      expect(response.statusCode).toBe(400);
    }
    expect(db.query).not.toHaveBeenCalled(); expect(db.connect).not.toHaveBeenCalled();
  });
  it('preserves nulls, negative altitude and extension keys', () => {
    const fields = {relevo: {altitude_minima_m:-100,altitude_maxima_m:0,declividade_maxima_graus:90,fonte:'legado'},antenas:{raio_analise_m:0,considerar_conflito_frequencia:false},vegetacoes:null};
    const copy=structuredClone(fields); new InstallCriterionValidation().Validate(fields); expect(fields).toEqual(copy);
  });
  it('rejects a one-sided PATCH conflicting with stored types under a row lock', async () => {
    db.query.mockImplementation(async (sql) => ({ rows: sql === lockInstallCriterionQuery ? [{tipos_elementos_permitidos:['TORRE'],tipos_elementos_proibidos:[]}] : [] }));
    const response=await app.inject({method:'PATCH',url:'/update-install-criterion/7',payload:{tipos_elementos_proibidos:['torres']}});
    expect(response.statusCode).toBe(400);
    expect(db.query.mock.calls.map(call=>call[0])).toEqual(['BEGIN',lockInstallCriterionQuery,'ROLLBACK']);
    expect(db.release).toHaveBeenCalledOnce();
  });
  it('moves a type between groups atomically', async () => {
    db.query.mockImplementation(async(sql)=>({rows:sql===lockInstallCriterionQuery?[{tipos_elementos_permitidos:['TORRE'],tipos_elementos_proibidos:[]}]:sql===updateInstallCriterionQuery?[{id_criterio_instalacao:7,id_usuario:1,nome:'Teste'}]:[]}));
    const response=await app.inject({method:'PATCH',url:'/update-install-criterion/7',payload:{tipos_elementos_permitidos:[],tipos_elementos_proibidos:['TORRES']}});
    expect(response.statusCode).toBe(200);
    expect(db.query.mock.calls.map(call=>call[0])).toEqual(['BEGIN',lockInstallCriterionQuery,updateInstallCriterionQuery,'COMMIT']);
    expect(db.release).toHaveBeenCalledOnce();
  });
  it('releases the connection when the criterion does not exist', async()=>{
    db.query.mockResolvedValue({rows:[]});
    const response=await app.inject({method:'PATCH',url:'/update-install-criterion/7',payload:{tipos_elementos_permitidos:[]}});
    expect(response.statusCode).toBe(404); expect(db.query).toHaveBeenLastCalledWith('ROLLBACK'); expect(db.release).toHaveBeenCalledOnce();
  });
});
