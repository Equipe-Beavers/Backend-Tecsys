import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarCriterioInstalacao } from "../models/criterio-instalacao.js";
import { criarCriterioInstalacao } from "../services/criterio-instalacao.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarCriterioInstalacaoController(
    request: FastifyRequest<{ Body: CriarCriterioInstalacao }>,
    reply: FastifyReply
) {
    try {
        const criterio = await criarCriterioInstalacao(request.body);

        return reply.status(201).send({
            mensagem: "Critério de instalação criado com sucesso",
            criterio
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar critério de instalação"
        );
    }
}
