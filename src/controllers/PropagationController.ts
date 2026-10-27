import type { FastifyReply, FastifyRequest } from "fastify";
import { PropagationService } from "../services/PropagationService.js";
import type { GenerateCoverageDTO } from "../interface/PropagationDTO.js";

export class PropagationController {
    private propagationService: PropagationService;

    constructor() {
        this.propagationService = new PropagationService();
    }

    async GenerateCoverage(request: FastifyRequest<{ Body: GenerateCoverageDTO }>, reply: FastifyReply) {
        try {
            const data = await this.propagationService.generateCoverage(request.body);
            return reply.status(200).send({ data });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao gerar mancha de cobertura.",
            });
        }
    }

    async GetScenarioCoverage(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        try {
            const data = await this.propagationService.getScenarioCoverage(request.params.id);
            return reply.status(200).send({ data });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao buscar a mancha do cenário.",
            });
        }
    }
}
