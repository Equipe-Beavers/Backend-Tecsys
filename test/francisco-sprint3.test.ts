import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';
import { AreaAssetService } from '../src/services/AreaAssetService.js';
import { GatewayMetadataService } from '../src/services/GatewayMetadataService.js';
import { ActiveService } from '../src/services/ActiveService.js';
import { ScenarioService } from '../src/services/ScenarioService.js';
import { RFService } from '../src/services/RFService.js';
import { ValidationService } from '../src/services/ValidationService.js';
import { findAssetByIdQuery } from '../src/database/queries/ativo_queries.js';
import type { EstudoPonto } from '../src/interface/estudo-ponto.js';
const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/database/pool.js', () => ({ pool: db }));
const geom = { type: 'Polygon' as const, coordinates: [[[-45,-23],[-44.99,-23],[-45,-22.99],[-45,-23]]] };
const point = { origem: 'manual', id_ativo_bdgd: null, atributos: null, tipo_ativo: null } as EstudoPonto;

describe('correções Francisco sprint 3', () => {
  beforeEach(() => { db.query.mockReset(); });
  afterEach(() => vi.restoreAllMocks());
  it('conta todos os tipos sem quotas e inclui pontos na borda', async () => {
    db.query.mockResolvedValue({rows:[{valida:true,total:9200}]});
    expect(await new AreaAssetService().count({geom, distribuidora:'EDP SP'})).toBe(9200);
    const [sql, args] = db.query.mock.calls[0]!;
    expect(sql).toContain('ST_Covers');expect(sql).toContain('postes');expect(sql).toContain('subestacoes');expect(sql).toContain('dispositivos');
    expect(sql).not.toMatch(/LIMIT|camadas|tipos/i);
    expect(args[1]).toBe('EDP SP');expect(args.slice(2)).toEqual([-45,-23,-44.99,-22.99]);
  });
  it('recusa geometria aberta antes da consulta e inválida após validação PostGIS', async () => {
    await expect(new AreaAssetService().count({geom:{type:'Polygon',coordinates:[geom.coordinates[0]!.slice(0,3)]}})).rejects.toBeInstanceOf(RangeError);
    expect(db.query).not.toHaveBeenCalled();
    db.query.mockResolvedValue({rows:[{valida:false,total:null}]});
    await expect(new AreaAssetService().count({geom})).rejects.toBeInstanceOf(RangeError);
  });
  it('rota valida coordenadas, rejeita filtros de camadas e retorna total independente', async () => {
    const app=new App().getInstance();app.log.level='silent';
    try {
      for (const payload of [{geom,tipos:['POSTE']},{geom:{...geom,coordinates:[[[181,0],[0,0],[0,1],[181,0]]]}}]) {
        const res=await app.inject({method:'POST',url:'/ativos/contagem-area',payload});
        expect(res.statusCode).toBe(400);
      }
      expect(db.query).not.toHaveBeenCalled();
      db.query.mockResolvedValue({rows:[{valida:true,total:42}]});
      const res=await app.inject({method:'POST',url:'/ativos/contagem-area',payload:{geom}});
      expect(res.statusCode).toBe(200);expect(res.json()).toEqual({total:42});
      db.query.mockRejectedValue(new Error('offline'));
      const failure=await app.inject({method:'POST',url:'/ativos/contagem-area',payload:{geom}});
      expect(failure.statusCode).toBe(503);
    } finally {await app.close();}
  });
  it('ponto manual usa local do estudo sem inventar ID ou alimentador', async () => {
    const lookup=vi.spyOn(ActiveService.prototype,'findAssetById');
    const result=await new GatewayMetadataService().attributes(point,{municipio:'Jacareí',uf:'SP'});
    expect(result.local).toBe('Jacareí · SP');expect(result.descricao_ativo).toBe('Ponto definido manualmente');
    expect(result.alimentador).toBeUndefined();expect(lookup).not.toHaveBeenCalled();
  });
  it('ponto BDGD usa dados verdadeiros do ativo e mantém alimentador informado', async () => {
    vi.spyOn(ActiveService.prototype,'findAssetById').mockResolvedValue({id:'DISPOSITIVO:A1',codId:'A1',tipo:'RELIGADOR',latitude:-23,longitude:-45,municipio:'Jacareí',bairro:'Centro',distribuidora:'EDP SP',tipoDispositivoId:32,tipoDispositivoNome:'Religador',tipoDispositivoCategoria:null,atributos:{subestacao:'S1'}});
    const result=await new GatewayMetadataService().attributes({...point,origem:'bdgd',id_ativo_bdgd:'DISPOSITIVO:A1',atributos:{alimentador:'AL-12'}},{uf:'SP'});
    expect(result.local).toBe('Centro · Jacareí · SP');expect(result.descricao_ativo).toBe('Religador');expect(result.alimentador).toBe('AL-12');
  });
  it('consulta de ID não usa parâmetros de bounding box inexistentes', () => {
    const query=findAssetByIdQuery('POSTE:ABC');
    expect(query.values).toEqual(['ABC','POSTE:ABC']);expect(query.text).not.toMatch(/\$[3-9]/);
    expect(query.text).toContain('AND a.cod_id = $1');
  });
  it('inserts de cenário, gateway e perfil não referenciam custos nem deixam placeholders deslocados', async () => {
    vi.spyOn(ValidationService.prototype,'verifyRecord').mockResolvedValue();
    db.query.mockResolvedValue({rows:[{id_cenario:1,id_cenario_gateway:1,id_perfil_rf:1}]});
    await new ScenarioService().createScenario({id_estudo:1,id_perfil_rf:1,nome:'Teste',status:'DEFINITIVO'});
    await new ScenarioService().createGatewayScenario({id_cenario:1,id_estudo_ponto:1});
    await new RFService().createRFProfile({id_usuario:1,nome:'Teste',frequencia_mhz:915,potencia_transmissao_dbm:14,sensibilidade_recepcao_dbm:-120});
    for(const [sql,args] of db.query.mock.calls){
      expect(sql).not.toMatch(/custo/);const matches=[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1]));
      expect(Math.max(...matches)).toBe(args.length);
    }
  });
});
