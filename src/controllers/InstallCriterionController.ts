import type { FastifyReply, FastifyRequest } from "fastify";
import { InstallCriterionService } from "../services/InstallCriterionService.js";
import type { CriarCriterioInstalacao } from "../interface/criterio-instalacao.js";

export class InstallCriterionController {
    private installCriterionService: InstallCriterionService;

    constructor() {
        this.installCriterionService = new InstallCriterionService();
    }

    async CreateInstallCriterion(request: FastifyRequest <{Body: CriarCriterioInstalacao}>, reply: FastifyReply) {
        try {
            const data = await this.installCriterionService.createInstallCriterion(request.body);
            return reply.status(201).send({
                message: "Critério de instalação criado com sucesso!",
                data
            })
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar critério de instalação."
            })
        }
    }
}