import type { FastifyReply, FastifyRequest } from "fastify";
import { RFService } from "../services/RFService.js";
import type { CreateRFProfileInput, CriarPerfilRf, RFProfileListQuery, UpdateRFProfileInput } from "../interface/perfil-rf.js";

export class RFController {
    private rfService: RFService;

    constructor() {
        this.rfService = new RFService();
    }

    async ListRFProfiles(request: FastifyRequest<{ Querystring: RFProfileListQuery }>, reply: FastifyReply) {
        try {
            const data = await this.rfService.listRFProfiles(request.query);
            return reply.status(200).send(data);
        } catch (error) {
            request.log.error({ err: error }, "RF profile list failed");
            return reply.status(500).send({ message: "Não foi possível carregar os perfis de RF." });
        }
    }

    async CreateLocalRFProfile(request: FastifyRequest<{ Body: CreateRFProfileInput }>, reply: FastifyReply) {
        try {
            const data = await this.rfService.createLocalRFProfile(request.body);
            return reply.status(201).send({ message: "Perfil de RF criado com sucesso!", data });
        } catch (error) {
            request.log.error({ err: error }, "RF profile creation failed");
            const code = typeof error === "object" && error !== null && "code" in error
                ? error.code
                : null;
            if (code === "23503") {
                return reply.status(400).send({ message: "Usuário não encontrado." });
            }
            return reply.status(500).send({ message: "Não foi possível salvar o perfil de RF." });
        }
    }

    async GetLocalRFProfile(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        try {
            const data = await this.rfService.getLocalRFProfile(request.params.id);
            if (!data) return reply.status(404).send({ message: "Perfil de RF não encontrado." });
            return reply.status(200).send({ data });
        } catch (error) {
            request.log.error({ err: error }, "RF profile lookup failed");
            return reply.status(500).send({ message: "Não foi possível abrir o perfil de RF." });
        }
    }

    async UpdateLocalRFProfile(
        request: FastifyRequest<{ Params: { id: number }; Body: UpdateRFProfileInput }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.rfService.updateLocalRFProfile(request.params.id, request.body);
            if (!data) return reply.status(404).send({ message: "Perfil de RF não encontrado." });
            return reply.status(200).send({ message: "Perfil de RF atualizado com sucesso!", data });
        } catch (error) {
            request.log.error({ err: error }, "RF profile update failed");
            return reply.status(500).send({ message: "Não foi possível atualizar o perfil de RF." });
        }
    }

    async DeleteLocalRFProfile(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        try {
            const deleted = await this.rfService.deleteLocalRFProfile(request.params.id);
            if (!deleted) return reply.status(404).send({ message: "Perfil de RF não encontrado." });
            return reply.status(204).send();
        } catch (error) {
            request.log.error({ err: error }, "RF profile deletion failed");
            const code = typeof error === "object" && error !== null && "code" in error
                ? error.code
                : null;
            if (code === "23503") {
                return reply.status(409).send({ message: "O perfil de RF está vinculado a estudos e não pode ser excluído." });
            }
            return reply.status(500).send({ message: "Não foi possível excluir o perfil de RF." });
        }
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