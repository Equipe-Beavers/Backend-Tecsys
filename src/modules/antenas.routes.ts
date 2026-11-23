import type { FastifyInstance } from "fastify";
import { AntenasController } from "../controllers/AntenasController.js";
import type { AntenasQuery } from "../interface/antena.js";

export async function antenasRoutes(app: FastifyInstance): Promise<void> {
    const controller = new AntenasController();

    app.get<{ Querystring: AntenasQuery }>(
        "/antenas",
        (request, reply) => controller.ListAntenas(request, reply),
    );
}
