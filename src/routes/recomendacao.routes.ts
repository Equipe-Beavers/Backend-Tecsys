import type { FastifyInstance } from "fastify";
import {
  gerarRecomendacaoController,
  type RecomendarBody,
  type RecomendarParams
} from "../controllers/recomendacao.controller.js";

export async function recomendacaoRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: RecomendarParams; Body: RecomendarBody }>(
    "/estudos/:id/recomendar",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "integer", minimum: 1 },
          },
        },
        body: {
          type: "object",
          required: ["id_perfil_rf"],
          additionalProperties: false,
          properties: {
            id_perfil_rf: { type: "integer", minimum: 1 },
            id_criterio_instalacao: {
              anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
            },
            nome_cenario: { type: "string" },
          },
        },
      },
    },
    gerarRecomendacaoController
  );
}