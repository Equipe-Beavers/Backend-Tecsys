import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationService } from "../src/services/RecommendationService.js";
import { EnvironmentalService, EnvironmentalContext } from "../src/services/EnvironmentalService.js";
import { StudyAssetPreparationService } from "../src/services/StudyAssetPreparationService.js";
import { PropagationService } from "../src/services/PropagationService.js";
import { createTestApp } from "./helpers/create-test-app.js";

const database = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

const candidates = Array.from({ length: 7 }, (_, index) => ({
  id_estudo_ponto: String(index + 1), id_estudo: "1", papel: "candidato", prioridade: "normal",
  tipo_ativo: [0, 2, 3].includes(index) ? "POSTE" : "REGULADOR", relevo_m: index === 2 ? 150 : 50,
  latitude: -23.2 + index * 0.001, longitude: -45.9, atributos: {},
}));
const interest = [101, 102].map((id) => ({
  id_estudo_ponto: String(id), id_estudo: "1", papel: "interesse", prioridade: "normal",
  latitude: id === 101 ? -23.199 : -23.196, longitude: -45.9, tipo_ativo: "POSTE", atributos: {},
}));
const geometry = { type: "Polygon", coordinates: [[[-45.9, -23.2], [-45.8, -23.2], [-45.9, -23.1], [-45.9, -23.2]]] };

describe("RecommendationService scenario groups", () => {
  const scenarios: Record<string, unknown>[] = [];
  const gateways: Record<string, any>[] = [];
  const attendances: Record<string, unknown>[] = [];
  const client = { query: vi.fn(), release: vi.fn() };

  beforeEach(() => {
    vi.restoreAllMocks();
    scenarios.length = gateways.length = attendances.length = 0;
    vi.spyOn(StudyAssetPreparationService.prototype, "prepare").mockResolvedValue({ totalCandidates: 7, importedCandidates: 0 });
    vi.spyOn(EnvironmentalService.prototype, "prepare").mockImplementation(async () => new EnvironmentalContext(null, null, null, new Map(candidates.map(point => [Number(point.id_estudo_ponto), point.relevo_m]))));
    client.query.mockReset();
    client.release.mockReset();
    database.query.mockReset();
    database.connect.mockResolvedValue(client);
    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM estudos WHERE")) return { rows: [{ id_estudo: "1" }] };
      if (sql.includes("SELECT * FROM perfis_rf")) return { rows: [{ capacidade_max_equipamentos: 4, custo_estimado_gateway: "50" }] };
      if (sql.includes("SELECT * FROM estudo_pontos")) return { rows: [...candidates, ...interest] };
      return { rows: [] };
    });
    client.query.mockImplementation(async (sql: string, values: any[] = []) => {
      if (sql.includes("INSERT INTO cenarios")) {
        const row = {
          id_cenario: scenarios.length + 1, id_estudo: values[0], id_perfil_rf: values[1],
          id_criterio_instalacao: values[2], id_cenario_base: values[3], nome: values[4], objetivo: values[6],
          status: values[7], quantidade_gateways: values[8], pontos_interesse: values[9], pontos_cobertos: values[10],
          pontos_nao_cobertos: values[11], percentual_cobertura: values[12], capacidade_utilizada_media_pct: values[13], custo_total_estimado: values[14],
        };
        scenarios.push(row);
        return { rows: [row] };
      }
      if (sql.includes("INSERT INTO cenario_gateways")) {
        const row = { id_cenario_gateway: gateways.length + 1, id_cenario: values[0], id_estudo_ponto: values[1], ordem: values[2] };
        gateways.push(row);
        return { rows: [row] };
      }
      if (sql.includes("INSERT INTO cenario_atendimentos")) {
        const row = { id_cenario_gateway: values[0], id_estudo_ponto: values[1], distancia_m: values[2], nivel_sinal_estimado_dbm: values[3] };
        attendances.push(row);
        return { rows: [row] };
      }
      if (sql.includes("UPDATE cenario_gateways SET")) {
        const gateway = gateways.find((item) => item.id_cenario_gateway === values[0])!;
        gateway.geometry = JSON.parse(values[1]);
        gateway.parametros_calculo = JSON.parse(values[2]);
      }
      return { rows: [{ id_estudo: 1 }] };
    });
    vi.spyOn(PropagationService.prototype, "buildParameters").mockReturnValue({} as never);
    vi.spyOn(PropagationService.prototype, "loadBuildings").mockResolvedValue(null);
    vi.spyOn(PropagationService.prototype, "calculateLinks").mockResolvedValue(new Map(
      interest.map((point) => [point.id_estudo_ponto, { distanceM: 123.4, signalDbm: -90, covered: true, pathLossDb: 0, buildingsLossDb: 0 }]),
    ));
    vi.spyOn(PropagationService.prototype, "buildCoverage").mockResolvedValue({ geometry, model: "Hata" } as never);
  });

  it("persists six independent deployments atomically and reuses RF calculations", async () => {
    const group = await new RecommendationService().generateRecommendation({ id_usuario: 1, id_estudo: 1, id_perfil_rf: 1 });
    expect(group.cenarios).toHaveLength(6);
    expect(group.cenarios.map((scenario) => scenario.nome)).toEqual(["Otimizada", "Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4", "Alternativa 5"]);
    expect(new Set(group.cenarios.map((scenario) => scenario.gateways[0]!.id_estudo_ponto)).size).toBe(6);
    expect(group.cenarios.every((scenario) => scenario.capacidade_utilizada_media_pct === 50)).toBe(true);
    expect(group.cenarios.every((scenario) => scenario.gateways[0]!.mancha_cobertura === geometry)).toBe(true);
    expect(group.cenarios.every((scenario) => scenario.ativos_mapa.every((asset) => asset.id_gateway_referencia === scenario.gateways[0]!.id_estudo_ponto))).toBe(true);
    expect(scenarios.slice(1).every((scenario) => scenario.id_cenario_base === 1)).toBe(true);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(PropagationService.prototype.calculateLinks).toHaveBeenCalledTimes(7);
    expect(PropagationService.prototype.buildCoverage).toHaveBeenCalledTimes(6);
    expect(gateways[0]!.parametros_calculo.pontos_interesse_snapshot).toHaveLength(2);
  });

  it("applies asset type, relief and distance rules from the installation criterion", async () => {
    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM estudos WHERE")) return { rows: [{ id_estudo: "1" }] };
      if (sql.includes("SELECT * FROM perfis_rf")) return { rows: [{ capacidade_max_equipamentos: 4, custo_estimado_gateway: "50" }] };
      if (sql.includes("SELECT * FROM estudo_pontos")) return { rows: [...candidates, ...interest] };
      if (sql.includes("criterios_instalacao")) return { rows: [{
        tipos_elementos_permitidos: ["POSTE"], tipos_elementos_proibidos: ["REGULADOR"],
        distancia_minima_ativos_m: "50", distancia_maxima_ativos_m: "200",
        limite_gateways: 1, custo_maximo: null,
        relevo: { altitude_minima_m: 20, altitude_maxima_m: 100 },
      }] };
      return { rows: [] };
    });
    vi.spyOn(PropagationService.prototype, "calculateLinks").mockImplementation(async (gateway) => {
      const candidateId = Math.round((gateway.latitude + 23.2) * 1000) + 1;
      return new Map(interest.map((point, index) => [point.id_estudo_ponto, {
        distanceM: candidateId === 1 ? (index === 0 ? 100 : 250) : (index === 0 ? 250 : 100),
        signalDbm: -90, covered: true, pathLossDb: 0, buildingsLossDb: 0,
      }]));
    });

    const group = await new RecommendationService().generateRecommendation({
      id_usuario: 1, id_estudo: 1, id_perfil_rf: 1, id_criterio_instalacao: 9,
    });

    expect(group.cenarios).toHaveLength(2);
    expect(group.cenarios.map((scenario) => scenario.gateways[0]!.id_estudo_ponto)).toEqual([1, 4]);
    expect(group.cenarios.every((scenario) => scenario.pontos_cobertos === 1)).toBe(true);
    expect(group.cenarios.every((scenario) => scenario.pontos_nao_cobertos === 1)).toBe(true);
    expect(group.cenarios[0]!.gateways[0]!.atendidos[0]!.id_estudo_ponto).toBe(101);
    expect(group.cenarios[1]!.gateways[0]!.atendidos[0]!.id_estudo_ponto).toBe(102);
  });

  it("loads each saved snapshot without recalculating and preserves the chosen scenario", async () => {
    const service = new RecommendationService();
    const generated = await service.generateRecommendation({ id_usuario: 1, id_estudo: 1, id_perfil_rf: 1 });
    scenarios[2]!.status = "DEFINITIVO";
    database.query.mockImplementation(async (sql: string, values: number[]) => {
      if (sql.includes("SELECT c.* FROM cenarios")) return { rows: scenarios };
      if (sql.includes("SELECT cg.*")) return { rows: gateways.filter((gateway) => gateway.id_cenario === values[0]) };
      if (sql.includes("SELECT a.*")) return { rows: attendances.filter((attendance) => attendance.id_cenario_gateway === values[0]) };
      throw new Error("Unexpected query: " + sql);
    });
    const loaded = await service.listRecommendations(1, 1);
    expect(loaded.id_cenario_selecionado).toBe(3);
    expect(loaded.cenarios.map((scenario) => scenario.ativos_mapa)).toEqual(generated.cenarios.map((scenario) => scenario.ativos_mapa));
    expect(loaded.cenarios[5]!.gateways[0]!.mancha_cobertura).toEqual(geometry);
    expect(PropagationService.prototype.calculateLinks).toHaveBeenCalledTimes(7);
  });

  it("rolls back the entire group on a persistence failure", async () => {
    client.query.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(new RecommendationService().generateRecommendation({ id_usuario: 1, id_estudo: 1, id_perfil_rf: 1 })).rejects.toThrow("database unavailable");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("loads a legacy single scenario without snapshots or regenerating it", async () => {
    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT c.* FROM cenarios")) return { rows: [{
        id_cenario: "85", id_estudo: "1", id_cenario_base: null,
        nome: "Estudo salvo", status: "DEFINITIVO", quantidade_gateways: 1,
        pontos_interesse: 2, pontos_cobertos: 1, pontos_nao_cobertos: 1,
        percentual_cobertura: "50", executado_em: "2026-11-22",
      }] };
      if (sql.includes("SELECT cg.*")) return { rows: [{
        id_cenario_gateway: "9", id_estudo_ponto: "1", candidato: candidates[0],
        geometry, parametros_calculo: null,
      }] };
      if (sql.includes("SELECT * FROM estudo_pontos")) return { rows: interest };
      if (sql.includes("SELECT a.*")) return { rows: [{
        id_cenario_gateway: "9", id_estudo_ponto: "101",
        distancia_m: "20", nivel_sinal_estimado_dbm: "-90",
      }] };
      throw new Error("Unexpected query: " + sql);
    });
    const loaded = await new RecommendationService().listRecommendations(1, 7);
    expect(database.query.mock.calls[0]![1]).toEqual([1, 7]);
    expect(loaded.alternativas_geradas).toBe(true);
    expect(loaded.id_cenario_selecionado).toBe(85);
    expect(loaded.cenarios[0]!.ativos_mapa.map(asset => asset.coberto)).toEqual([true, false]);
    expect(loaded.cenarios[0]!.gateways[0]!.mancha_cobertura).toEqual(geometry);
    expect(loaded.cenarios[0]!.gateways[0]!.atendidos[0]!.distancia_m).toBe(20);
    expect(PropagationService.prototype.calculateLinks).not.toHaveBeenCalled();
  });

  it("returns an empty group so the frontend can generate a new recommendation", async () => {
    const loaded = await new RecommendationService().listRecommendations(1, 1);
    expect(loaded).toMatchObject({ cenarios: [], alternativas_geradas: false, id_cenario_selecionado: null });
  });

  it("selects exactly one scenario without modifying gateway data", async () => {
    const result = await new RecommendationService().selectRecommendation(1, 3, 1);
    expect(result.id_cenario_selecionado).toBe(3);
    expect(client.query.mock.calls.filter(([sql]) => sql.includes("UPDATE cenarios"))).toHaveLength(2);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("UPDATE cenario_gateways"))).toBe(false);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects scenarios from another study or an outdated group before any update", async () => {
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("SELECT c.id_cenario") ? [] : [{ id_estudo: 1 }] }));
    await expect(new RecommendationService().selectRecommendation(1, 999, 1)).rejects.toThrow("grupo atual");
    expect(client.query.mock.calls.some(([sql]) => sql.includes("UPDATE cenarios"))).toBe(false);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("exposes saved groups and validates the selection endpoint", async () => {
    const app = createTestApp();
    const response = await app.inject("/study/1/recommendations");
    expect(response.statusCode).toBe(200);
    expect(response.json().cenarios).toEqual([]);
    expect((await app.inject({ method: "PATCH", url: "/study/1/selected-scenario", payload: { id_cenario: 0 } })).statusCode).toBe(400);
    const selected = await app.inject({ method: "PATCH", url: "/study/1/selected-scenario", payload: { id_cenario: 3 } });
    expect(selected.statusCode).toBe(200);
    expect(selected.json().id_cenario_selecionado).toBe(3);
    await app.close();
  });
});
