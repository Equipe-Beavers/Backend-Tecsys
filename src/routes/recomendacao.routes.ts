import type { FastifyInstance } from "fastify";
import { gerarRecomendacao } from "../services/recomendacao/recomendacao.service.js";

interface RecomendarParams {
  id: number;
}

interface RecomendarBody {
  id_perfil_rf: number;
  id_criterio_instalacao?: number | null;
  nome_cenario?: string;
}

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
    async (request, reply) => {
      try {
        const resultado = await gerarRecomendacao({
          id_estudo: request.params.id,
          id_perfil_rf: request.body.id_perfil_rf,
          id_criterio_instalacao: request.body.id_criterio_instalacao ?? null,
          nome_cenario: request.body.nome_cenario,
        });

        return reply.status(201).send(resultado);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : "Erro desconhecido ao gerar recomendação";
        fastify.log.error(error);
        return reply.status(400).send({ erro: mensagem });
      }
    }
  );
}