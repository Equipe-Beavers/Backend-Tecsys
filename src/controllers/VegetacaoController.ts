import type { FastifyReply, FastifyRequest } from "fastify";
import { VegetacaoService } from "../services/VegetacaoService.js";

export class VegetacaoController {
    private readonly vegetacaoService: VegetacaoService;

    constructor(vegetacaoService?: VegetacaoService) {
        this.vegetacaoService = vegetacaoService ?? new VegetacaoService();
    }

    async GetConfig(request: FastifyRequest, reply: FastifyReply) {
        try {
            return reply.send(this.vegetacaoService.obterConfiguracao());
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                error: "Não foi possível obter a configuração da camada de vegetação.",
            });
        }
    }
}
