import type { FastifyInstance } from "fastify";
import { VegetacaoController } from "../controllers/VegetacaoController.js";

/** Registra as rotas HTTP da camada de vegetação. */
export async function vegetacaoRoutes(app: FastifyInstance): Promise<void> {
    const controller = new VegetacaoController();

    app.get("/api/vegetacao/config", (request, reply) =>
        controller.GetConfig(request, reply),
    );
}
