import type { FastifyInstance } from "fastify";

import type { CenarioGateway, CriarCenarioGateway } from "../models/cenario-gateway.js";
import { criarCenarioGateway } from "../services/cenario-gateway.service.js";
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
        async (request, reply) => {
            try {
                const gateway = await criarCenarioGateway(request.body);
                return reply.status(201).send({ mensagem: "Gateway do cenário criado com sucesso", gateway });
            } catch (error) {
                const mensagem = error instanceof Error ? error.message : "Erro desconhecido ao criar gateway do cenário";
                fastify.log.error(error);
                return reply.status(400).send({ erro: mensagem });
            }
        }
    );
}