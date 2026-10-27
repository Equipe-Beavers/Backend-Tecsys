import type { FastifyInstance } from "fastify";
import { RegionsController } from "../controllers/RegionsController.js";

export async function regioesRoutes(app: FastifyInstance): Promise<void> {
  const controller = new RegionsController();

  app.get("/distribuidoras", (request, reply) =>
    controller.ListDistributor(
      request as Parameters<RegionsController["ListDistributor"]>[0],
      reply,
    ),
  );

  app.get("/estados", (request, reply) =>
    controller.ListStates(
      request as Parameters<RegionsController["ListStates"]>[0],
      reply,
    ),
  );

  app.get("/municipios", (request, reply) =>
    controller.ListMunicipios(
      request as Parameters<RegionsController["ListMunicipios"]>[0],
      reply,
    ),
  );

  app.get("/bairros", (request, reply) =>
    controller.ListNeighborhood(
      request as Parameters<RegionsController["ListNeighborhood"]>[0],
      reply,
    ),
  );
}
