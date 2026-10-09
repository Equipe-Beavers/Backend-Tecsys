import type { FastifyReply, FastifyRequest } from "fastify";
import { StudyService } from "../services/StudyService.js";
import type { CriarEstudo } from "../interface/estudo.js";
import type { CriarEstudoPonto } from "../interface/estudo-ponto.js";

export class StudyController {
    private studyService: StudyService;

    constructor() {
        this.studyService = new StudyService();
    }

    async CreateStudy(request: FastifyRequest <{Body: CriarEstudo}>, reply: FastifyReply) {
        try {
            const data = await this.studyService.createStudy(request.body);
            return reply.status(201).send({
                message: "Estudo criado com sucesso!",
                data
            })
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar estudo."
            })
        }
    }

    async CreateStudyPoint(request: FastifyRequest <{Body: CriarEstudoPonto}>, reply: FastifyReply) {
        try {
            const data = await this.studyService.createStudyPoint(request.body);
            return reply.status(201).send({
                message: "Ponto adicionado ao estudo com sucesso!",
                data
            })

        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar ponto."
            })
        }
    }
}