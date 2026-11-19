import type { FastifyInstance } from "fastify";
import { AreaAssetService, type AreaAssetInput } from "../services/AreaAssetService.js";
import { ActiveController } from "../controllers/ActiveController.js";

export async function ativoRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ActiveController();

  app.post<{ Body: AreaAssetInput }>("/ativos/contagem-area", {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['geom'],
      properties: {
        distribuidora: { type: 'string', minLength: 1, maxLength: 150 },
        geom: { type: 'object', additionalProperties: false, required: ['type', 'coordinates'], properties: {
          type: { type: 'string', const: 'Polygon' },
          coordinates: { type: 'array', minItems: 1, maxItems: 1, items: {
            type: 'array', minItems: 4, maxItems: 1000, items: {
              type: 'array', minItems: 2, maxItems: 2, items: [
                { type: 'number', minimum: -180, maximum: 180 },
                { type: 'number', minimum: -90, maximum: 90 },
              ],
            },
          } },
        } },
      },
    } },
  }, async (request, reply) => {
    try { return { total: await new AreaAssetService().count(request.body) }; }
    catch (error) {
      if (error instanceof RangeError) return reply.status(400).send({ message: error.message });
      request.log.error({ err: error }, 'Falha ao contar ativos da área');
      return reply.status(503).send({ message: 'Não foi possível contar os ativos da área.' });
    }
  });

  app.get("/ativos/distribuidoras", (request, reply) =>
    controller.FindDistributors(request, reply),
  );

  app.get("/ativos/tipos-dispositivos", (request, reply) =>
    controller.FindDeviceTypes(request, reply),
  );

  app.get("/ativos", (request, reply) =>
    controller.FindAssets(
      request as Parameters<ActiveController["FindAssets"]>[0],
      reply,
    ),
  );

  app.get("/ativos/:id", (request, reply) =>
    controller.FindAssetById(
      request as Parameters<ActiveController["FindAssetById"]>[0],
      reply,
    ),
  );
}
