import type { FastifyInstance } from "fastify";

import type { Cenario, CriarCenario } from "../models/cenario.js";
import { criarCenarioController } from "../controllers/cenario.controller.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function cenarioRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<Cenario>(fastify, {
        caminho: "/cenarios",
        tabela: "cenarios",
        colunaId: "id_cenario",
        entidade: "Cenário",
        chaveResposta: "cenarios"
    });

    fastify.post<{ Body: CriarCenario }>(
        "/cenarios",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["id_estudo", "id_perfil_rf", "nome", "status"],
                    additionalProperties: false,
                    properties: {
                        id_estudo: { type: "integer", minimum: 1 },
                        id_perfil_rf: { type: "integer", minimum: 1 },
                        id_criterio_instalacao: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
                        id_cenario_base: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
                        nome: { type: "string", minLength: 1 },
                        descricao: { anyOf: [{ type: "string" }, { type: "null" }] },
                        objetivo: { anyOf: [{ type: "string" }, { type: "null" }] },
                        status: { type: "string", minLength: 1 },
                        quantidade_gateways: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        pontos_interesse: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        pontos_cobertos: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        pontos_nao_cobertos: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        percentual_cobertura: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
                        capacidade_utilizada_media_pct: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
                        custo_total_estimado: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        mancha_consolidada: { anyOf: [{ type: "object" }, { type: "null" }] },
                        executado_em: { anyOf: [{ type: "string" }, { type: "null" }] }
                    }
                }
            }
        },
        criarCenarioController
    );
}