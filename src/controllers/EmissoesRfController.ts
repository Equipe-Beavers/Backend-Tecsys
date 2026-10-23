import type { FastifyReply, FastifyRequest } from "fastify";
import type { EmissoesRfQuery } from "../interface/emissoes-rf.js";
import { EmissoesRfService, EmissoesRfValidationError } from "../services/EmissoesRfService.js";

export class EmissoesRfController {
    private readonly service: EmissoesRfService;

    constructor(service?: EmissoesRfService) {
        this.service = service ?? new EmissoesRfService();
    }

    async ListEmissoes(
        request: FastifyRequest<{ Querystring: EmissoesRfQuery }>,
        reply: FastifyReply,
    ) {
        try {
            return reply.send(await this.service.listar(request.query));
        } catch (error) {
            if (error instanceof EmissoesRfValidationError) {
                return reply.code(400).send({ error: error.message });
            }
            request.log.error(error);
            return reply.code(500).send({ error: "Não foi possível consultar as emissões RF da Anatel." });
        }
    }
}
