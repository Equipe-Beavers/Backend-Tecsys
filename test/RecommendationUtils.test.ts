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
});
