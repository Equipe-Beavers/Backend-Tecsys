import type { FastifyReply, FastifyRequest } from "fastify";
import { RFService } from "../services/RFService.js";
import type { CriarPerfilRf } from "../interface/perfil-rf.js";

export class RFController {
    private rfService: RFService;

    constructor() {
        this.rfService = new RFService();;
    }

    async CreateRFProfile(request: FastifyRequest<{Body: CriarPerfilRf}>, reply: FastifyReply) {
        try {
            const data = await this.rfService.createRFProfile(request.body);
            return reply.status(201).send({
                message: "Perfil de RF criado com sucesso!",
                data
            })
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar perfil de RF."
            })
        }
    }
}