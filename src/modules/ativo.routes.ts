import type { FastifyInstance } from "fastify";
import { ActiveController } from "../controllers/ActiveController.js";

export async function ativoRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ActiveController();

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
