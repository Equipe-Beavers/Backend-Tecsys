import type { FastifyReply, FastifyRequest } from "fastify";
import type { AntenasQuery } from "../interface/antena.js";
import {
    AntenasService,
    AntenasValidationError,
} from "../services/AntenasService.js";

export class AntenasController {
    private readonly antenasService: AntenasService;

    constructor(antenasService?: AntenasService) {
        this.antenasService = antenasService ?? new AntenasService();
    }

    async ListAntenas(
        request: FastifyRequest<{ Querystring: AntenasQuery }>,
        reply: FastifyReply,
    ) {
        try {
            const resultado = await this.antenasService.listar(request.query);
            return reply.send(resultado);
        } catch (error) {
            if (error instanceof AntenasValidationError) {
                return reply.code(400).send({ error: error.message });
            }

            request.log.error(error);
            return reply.code(500).send({
                error: "Não foi possível consultar as antenas da Anatel.",
            });
        }
    }
}
