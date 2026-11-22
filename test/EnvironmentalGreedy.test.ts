import { describe, expect, it } from "vitest";
import type { EstudoPonto } from "../src/interface/estudo-ponto.js";
import type { PerfilRf } from "../src/interface/perfil-rf.js";
import { RecommendationUtils, type AtendimentoCalculado } from "../src/utils/RecommendationUtils.js";

const point = (id: number, papel: "candidato" | "interesse"): EstudoPonto => ({
  id_estudo_ponto: id, id_estudo: 1, origem: "bdgd", id_ativo_bdgd: `${id}`,
  tipo_ativo: "POSTE", rotulo: null, papel, prioridade: "normal",
  latitude: -23, longitude: -46 + id / 10000, relevo_m: null,
  atributos: null, geom: null, criado_em: "",
});

describe("US72: greedy ambiental", () => {
  it("usa a proximidade de infraestrutura somente como desempate de candidatos que cobrem ativos", () => {
    const interest = point(100, "interesse");
    const candidates = [point(1, "candidato"), point(2, "candidato")];
    const attendance: AtendimentoCalculado = {
      ponto: interest, distanciaM: 100, nivelSinalDbm: -90,
    };
    const coverage = new Map([[1, [attendance]], [2, [attendance]]]);
    const result = new RecommendationUtils().CalculateRecommendation(
      candidates, [interest], { capacidade_max_equipamentos: null } as PerfilRf,
      coverage, new Map([[2, 0.15]]),
    );
    expect(result.gateways[0]?.candidato.id_estudo_ponto).toBe(2);
    expect(result.pontosNaoCobertos).toHaveLength(0);
  });
});
