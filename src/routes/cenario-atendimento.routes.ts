import type { FastifyInstance } from "fastify";

import type { CenarioAtendimento, CriarCenarioAtendimento } from "../models/cenario-atendimento.js";
import { criarCenarioAtendimento } from "../services/cenario-atendimento.service.js";
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
        async (request, reply) => {
            try {
                const atendimento = await criarCenarioAtendimento(request.body);
                return reply.status(201).send({ mensagem: "Atendimento do cenário criado com sucesso", atendimento });
            } catch (error) {
                const mensagem = error instanceof Error ? error.message : "Erro desconhecido ao criar atendimento do cenário";
                fastify.log.error(error);
                return reply.status(400).send({ erro: mensagem });
            }
        }
    );
}