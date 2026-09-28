import type { FastifyInstance } from "fastify";

import type { CriarPerfilRf, PerfilRf } from "../models/perfil-rf.js";
import { criarPerfilRfController } from "../controllers/perfil-rf.controller.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function perfilRfRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<PerfilRf>(fastify, {
        caminho: "/perfis-rf",
        tabela: "perfis_rf",
        colunaId: "id_perfil_rf",
        entidade: "Perfil RF",
        chaveResposta: "perfis"
    });

    fastify.post<{ Body: CriarPerfilRf }>(
        "/perfis-rf",
        {
            schema: {
                body: {
                    type: "object",
                    required: [
                        "id_usuario", "nome", "frequencia_mhz",
                        "potencia_transmissao_dbm", "sensibilidade_recepcao_dbm"
                    ],
                    additionalProperties: false,
                    properties: {
                        id_usuario: { type: "integer", minimum: 1 },
                        nome: { type: "string", minLength: 1 },
                        modelo_gateway: { anyOf: [{ type: "string" }, { type: "null" }] },
                        frequencia_mhz: { type: "number" },
                        potencia_transmissao_dbm: { type: "number" },
                        sensibilidade_recepcao_dbm: { type: "number" },
                        alcance_estimado_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        altura_gateway_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        altura_dispositivo_m: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        capacidade_max_equipamentos: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        quantidade_canais: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        limite_mensagens_transmissoes: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
                        periodo_limite_mensagens: { anyOf: [{ type: "string" }, { type: "null" }] },
                        custo_estimado_gateway: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
                        caracteristicas_antena: { anyOf: [{ type: "object" }, { type: "null" }] },
                        considera_relevo: { type: "boolean" },
                        considera_vegetacao: { type: "boolean" },
                        considera_edificacoes: { type: "boolean" },
                        considera_obstaculos: { type: "boolean" },
                        parametros_adicionais: { anyOf: [{ type: "object" }, { type: "null" }] }
                    }
                }
            }
        },
        criarPerfilRfController
    );
}