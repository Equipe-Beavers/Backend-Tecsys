import type { FastifyInstance } from "fastify";

import type { CriterioInstalacao, CriarCriterioInstalacao } from "../models/criterio-instalacao.js";
import { criarCriterioInstalacaoController } from "../controllers/criterio-instalacao.controller.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function criterioInstalacaoRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<CriterioInstalacao>(fastify, {
        caminho: "/criterios-instalacao",
        tabela: "criterios_instalacao",
        colunaId: "id_criterio_instalacao",
        entidade: "Critério de instalação",
        chaveResposta: "criterios"
    });

    fastify.post<{ Body: CriarCriterioInstalacao }>(
        "/criterios-instalacao",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["id_usuario", "nome"],
                    additionalProperties: false,
                    properties: {
                        id_usuario: { type: "integer", minimum: 1 },
                        nome: { type: "string", minLength: 1 },
                        descricao: { anyOf: [{ type: "string" }, { type: "null" }] },
                        tipos_elementos_permitidos: { anyOf: [{ type: "object" }, { type: "null" }] },
                        tipos_elementos_proibidos: { anyOf: [{ type: "object" }, { type: "null" }] },
                        requer_alimentacao_eletrica: { anyOf: [{ type: "boolean" }, { type: "null" }] },
                        altura_minima_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        distancia_maxima_ativos_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        caracteristicas_minimas_local: { anyOf: [{ type: "object" }, { type: "null" }] },
                        locais_autorizados: { anyOf: [{ type: "object" }, { type: "null" }] },
                        locais_obrigatorios: { anyOf: [{ type: "object" }, { type: "null" }] },
                        locais_proibidos: { anyOf: [{ type: "object" }, { type: "null" }] },
                        limite_gateways: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        custo_maximo: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] }
                    }
                }
            }
        },
        criarCriterioInstalacaoController
    );
}