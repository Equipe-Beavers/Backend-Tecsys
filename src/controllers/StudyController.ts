import type { FastifyReply, FastifyRequest } from "fastify";
import { StudyService } from "../services/StudyService.js";
import type { CriarEstudo, UpdateStudyDTO } from "../interface/estudo.js";
import { StudyError } from "../utils/StudyError.js";
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
                estudo: data,
                data
            })
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar estudo."
            })
        }
    }

    async ListStudies(request: FastifyRequest<{ Querystring: { id_usuario?: number } }>, reply: FastifyReply) {
        try {
            const studies = await this.studyService.listStudies(request.query.id_usuario);
            return reply.send({ estudos: studies });
        } catch (error: unknown) {
            request.log.error(error);
            return reply.status(500).send({ erro: "Não foi possível carregar os estudos." });
        }
    }

    private HandleError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
        if (error instanceof StudyError) return reply.status(error.statusCode).send({ message: error.message });
        request.log.error({ err: error }, "Study operation failed");
        return reply.status(500).send({ message: "Não foi possível concluir a operação de estudos." });
    }

    async GetStudy(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        try {
            return reply.send({ estudo: await this.studyService.getStudy(request.params.id) });
        } catch (error) {
            return this.HandleError(error, request, reply);
        }
    }

    async UpdateStudy(request: FastifyRequest<{ Params: { id: number }; Body: UpdateStudyDTO }>, reply: FastifyReply) {
        try {
            return reply.send({ estudo: await this.studyService.updateStudy(request.params.id, request.body) });
        } catch (error) {
            return this.HandleError(error, request, reply);
        }
    }

    async DeleteStudy(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        try {
            await this.studyService.deleteStudy(request.params.id);
            return reply.status(204).send();
        } catch (error) {
            return this.HandleError(error, request, reply);
        }
    }

    async CalculateStudyBuildings(request: FastifyRequest<{ Params: { id: number }; Body: unknown }>, reply: FastifyReply) {
        try {
            return reply.send(await this.studyService.calculateStudyBuildings(request.params.id, request.body));
        } catch (error) {
            return this.HandleError(error, request, reply);
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