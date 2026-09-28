import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarEstudo } from "../models/estudo.js";
import { criarEstudo } from "../services/estudo.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarEstudoController(
    request: FastifyRequest<{ Body: CriarEstudo }>,
    reply: FastifyReply
) {
    try {
        const estudo = await criarEstudo(request.body);

        return reply.status(201).send({
            mensagem: "Estudo criado com sucesso",
            estudo
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar estudo"
        );
    }
}
