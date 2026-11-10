import { describe, expect, it } from "vitest";

import type { EstudoPonto } from "../src/interface/estudo-ponto.js";
import type { PerfilRf } from "../src/interface/perfil-rf.js";
import { RecommendationUtils, type AtendimentoCalculado } from "../src/utils/RecommendationUtils.js";

const utils = new RecommendationUtils();

function point(id: number, extra: Partial<EstudoPonto> = {}): EstudoPonto {
    return {
        id_estudo_ponto: id,
        id_estudo: 1,
        origem: "bdgd",
        id_ativo_bdgd: `POSTE-${id}`,
        tipo_ativo: "POSTE",
        rotulo: null,
        papel: "candidato",
        prioridade: "normal",
        latitude: -23.2,
        longitude: -45.9 + id * 0.001,
        atributos: null,
        ...extra,
    } as EstudoPonto;
}

describe("RecommendationUtils.CalculateRecommendation", () => {
    const profile = { capacidade_max_equipamentos: null } as unknown as PerfilRf;
    const meters = [1, 2, 3, 4].map((id) => point(100 + id, { papel: "interesse" }));
    const serve = (ids: number[]): AtendimentoCalculado[] =>
        ids.map((id) => ({ ponto: meters[id - 1]!, distanciaM: 100, nivelSinalDbm: -100 }));

    const candidates = [point(1), point(2)];
    const coverage = new Map<number, AtendimentoCalculado[]>([
        [1, serve([1, 2, 3])],
        [2, serve([4])],
    ]);

    it("escolhe primeiro o candidato que cobre mais pontos", () => {
        const result = utils.CalculateRecommendation(candidates, meters, profile, coverage);
        expect(result.gateways.map((g) => g.candidato.id_estudo_ponto)).toEqual([1, 2]);
        expect(result.pontosNaoCobertos).toHaveLength(0);
    });

    it("gera seis conjuntos distintos sem alterar os enlaces ou resultados anteriores", () => {
        const options = Array.from({ length: 7 }, (_, index) => point(index + 1));
        const links = new Map(options.map((candidate) => [candidate.id_estudo_ponto, serve([1, 2, 3, 4])]));
        const results = utils.CalculateAlternatives(options, meters, profile, links);
        expect(results).toHaveLength(6);
        expect(new Set(results.map((result) => result.gateways.map((gateway) => gateway.candidato.id_estudo_ponto).join(","))).size).toBe(6);
        expect(results[0]!.gateways[0]!.candidato.id_estudo_ponto).toBe(1);
        expect(results.every((result) => result.pontosNaoCobertos.length === 0)).toBe(true);
        results[1]!.gateways.pop();
        expect(results[0]!.gateways).toHaveLength(1);
        expect(links.get(1)).toHaveLength(4);
    });

    it("respeita capacidade e limite de gateways e nao fabrica alternativas duplicadas", () => {
        const limited = { capacidade_max_equipamentos: 1 } as PerfilRf;
        const results = utils.CalculateAlternatives(candidates, meters, limited, coverage, 1);
        expect(results).toHaveLength(2);
        expect(results.every((result) => result.gateways.length === 1)).toBe(true);
        expect(results.every((result) => result.gateways[0]!.atendimentos.length === 1)).toBe(true);
        expect(results.every((result) => result.pontosNaoCobertos.length === 3)).toBe(true);
    });
});
