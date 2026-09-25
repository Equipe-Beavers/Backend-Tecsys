import type { FastifyInstance } from "fastify";

import type { CenarioAtendimento, CriarCenarioAtendimento } from "../models/cenario-atendimento.js";
import { criarCenarioAtendimentoController } from "../controllers/cenario-atendimento.controller.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function cenarioAtendimentoRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<CenarioAtendimento>(fastify, {
        caminho: "/cenario-atendimentos",
        tabela: "cenario_atendimentos",
        colunaId: "id_atendimento",
        entidade: "Atendimento do cenário",
        chaveResposta: "atendimentos"
    });

    fastify.post<{ Body: CriarCenarioAtendimento }>(
        "/cenario-atendimentos",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["id_cenario_gateway", "id_estudo_ponto"],
                    additionalProperties: false,
                    properties: {
                        id_cenario_gateway: { type: "integer", minimum: 1 },
                        id_estudo_ponto: { type: "integer", minimum: 1 },
                        distancia_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        nivel_sinal_estimado_dbm: { anyOf: [{ type: "number" }, { type: "null" }] }
                    }
                }
            }
        },
        criarCenarioAtendimentoController
    );
}