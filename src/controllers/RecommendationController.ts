import type { FastifyReply, FastifyRequest } from "fastify";
import { RecommendationService } from "../services/RecommendationService.js";


export interface RecomendarParams {
    id: number;
}

export interface RecomendarBody {
    id_perfil_rf: number;
    id_criterio_instalacao?: number | null;
    nome_cenario?: string;
}

export class RecommendationController {
    private recommendationService: RecommendationService;

    constructor() {
        this.recommendationService = new RecommendationService();;
    }

    async GenerateRecommendation(request: FastifyRequest<{Params: RecomendarParams, Body: RecomendarBody}>, reply: FastifyReply) {
        try {
             const data = await this.recommendationService.generateRecommendation({
                id_estudo: request.params.id,
                id_perfil_rf: request.body.id_perfil_rf,
                id_criterio_instalacao: request.body.id_criterio_instalacao ?? null,
                nome_cenario: request.body.nome_cenario
             })

             return reply.status(201).send(data);
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao gerar recomendação."
            })
        }
    }
}