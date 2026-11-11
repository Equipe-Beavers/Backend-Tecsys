import { describe, expect, it } from "vitest";
import type { EstudoPonto } from "../src/interface/estudo-ponto.js";
import type { PropagationParameters } from "../src/interface/PropagationDTO.js";
import { EnvironmentalContext, TerrainGrid, VegetationGrid } from "../src/services/EnvironmentalService.js";

const box = { south: -23.01, north: -22.99, west: -46.01, east: -45.99 };
const params: PropagationParameters = {
  frequencyMhz: 915, txPowerDbm: 20, rxSensitivityDbm: -120,
  gatewayGainDbi: 0, deviceGainDbi: 0, cableLossDb: 0,
  marginDb: 10, gatewayHeightM: 15, deviceHeightM: 2,
  environment: "rural", considerBuildings: true, estimatedRangeM: null,
};
const candidate = (extra: Partial<EstudoPonto> = {}): EstudoPonto => ({
  id_estudo_ponto: 1, id_estudo: 1, origem: "bdgd", id_ativo_bdgd: "POSTE-1",
  tipo_ativo: "POSTE", rotulo: null, papel: "candidato", prioridade: "normal",
  latitude: -23, longitude: -46, relevo_m: null, atributos: null, geom: null, criado_em: "",
  ...extra,
});

describe("US72: ambiente e propagacao", () => {
  it("nao inventa atenuacao nem exclui candidatos quando as fontes falham", () => {
    const ctx = new EnvironmentalContext(null, null, null);
    expect(ctx.summary.fontes.relevo).toBe("indisponivel");
    expect(ctx.summary.fontes.vegetacao).toBe("indisponivel");
    expect(ctx.checkCandidate(candidate(), null, [], null).eligible).toBe(true);
    expect(ctx.loss({ latitude: -23, longitude: -46 }, { latitude: -23, longitude: -45.995 }, 500, params))
      .toEqual({ relevo_db: 0, vegetacao_db: 0 });
  });

  it("avalia relevo entre pontos, nao apenas a altitude dos extremos", () => {
    const grid = new TerrainGrid(box, 3, [
      100, 100, 100,
      100, 350, 100,
      100, 100, 100,
    ]);
    const ctx = new EnvironmentalContext(grid, null, null);
    const losses = ctx.loss(
      { latitude: -23, longitude: -46.009 },
      { latitude: -23, longitude: -45.991 },
      1800,
      params,
    );
    expect(losses.relevo_db).toBeGreaterThan(0);
    expect(losses.vegetacao_db).toBe(0);
  });

  it("leva vegetacao mapeada ao orcamento do enlace e restringe pontos em agua", () => {
    const forest = new VegetationGrid(box, 64, [{
      kind: "arvores",
      box,
      ring: [[-46.01, -23.01], [-45.99, -23.01], [-45.99, -22.99], [-46.01, -22.99], [-46.01, -23.01]],
    }]);
    const ctx = new EnvironmentalContext(null, forest, null);
    expect(ctx.loss(
      { latitude: -23, longitude: -46.009 },
      { latitude: -23, longitude: -45.991 }, 1600, params,
    ).vegetacao_db).toBeGreaterThan(0);

    const water = new VegetationGrid(box, 32, [{
      kind: "agua", box,
      ring: [[-46.01, -23.01], [-45.99, -23.01], [-45.99, -22.99], [-46.01, -22.99], [-46.01, -23.01]],
    }]);
    expect(new EnvironmentalContext(null, water, null)
      .checkCandidate(candidate(), null, [], null).eligible).toBe(false);
  });

  it("aplica altitude declarada apenas quando conhecida", () => {
    const ctx = new EnvironmentalContext(null, null, null, new Map([[1, 20]]));
    const criterion = { relevo: { altitude_minima_m: 100 } };
    expect(ctx.checkCandidate(candidate({ relevo_m: 20 }), criterion, [], null).eligible).toBe(false);
    expect(new EnvironmentalContext(null, null, null)
      .checkCandidate(candidate(), criterion, [], null).eligible).toBe(true);
  });
});
