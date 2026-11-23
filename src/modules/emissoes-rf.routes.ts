import type { FastifyInstance } from "fastify";
import { EmissoesRfController } from "../controllers/EmissoesRfController.js";
import type { EmissoesRfQuery } from "../interface/emissoes-rf.js";

export async function emissoesRfRoutes(app: FastifyInstance): Promise<void> {
    const controller = new EmissoesRfController();
    app.get<{ Querystring: EmissoesRfQuery }>(
        "/emissoes-rf",
        (request, reply) => controller.ListEmissoes(request, reply),
    );
}
