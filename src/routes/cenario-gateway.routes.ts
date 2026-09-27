import type { FastifyInstance } from "fastify";

import type { CenarioGateway, CriarCenarioGateway } from "../models/cenario-gateway.js";
import { criarCenarioGatewayController } from "../controllers/cenario-gateway.controller.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function cenarioGatewayRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<CenarioGateway>(fastify, {
        caminho: "/cenario-gateways",
        tabela: "cenario_gateways",
        colunaId: "id_cenario_gateway",
        entidade: "Gateway do cenário",
        chaveResposta: "gateways"
    });

    fastify.post<{ Body: CriarCenarioGateway }>(
        "/cenario-gateways",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["id_cenario", "id_estudo_ponto"],
                    additionalProperties: false,
                    properties: {
                        id_cenario: { type: "integer", minimum: 1 },
                        id_estudo_ponto: { type: "integer", minimum: 1 },
                        ordem: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        quantidade_pontos_atendidos: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        capacidade_utilizada_pct: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
                        custo_estimado: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        parametros_calculo: { anyOf: [{ type: "object" }, { type: "null" }] },
                        mancha_cobertura: { anyOf: [{ type: "object" }, { type: "null" }] }
                    }
                }
            }
        },
        criarCenarioGatewayController
    );
}