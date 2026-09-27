import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarPerfilRf } from "../models/perfil-rf.js";
import { criarPerfilRf } from "../services/perfil-rf.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarPerfilRfController(
    request: FastifyRequest<{ Body: CriarPerfilRf }>,
    reply: FastifyReply
) {
    try {
        const perfil = await criarPerfilRf(request.body);

        return reply.status(201).send({
            mensagem: "Perfil RF criado com sucesso",
            perfil
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar perfil RF"
        );
    }
}
