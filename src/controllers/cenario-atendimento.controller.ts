import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarCenarioAtendimento } from "../models/cenario-atendimento.js";
import { criarCenarioAtendimento } from "../services/cenario-atendimento.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarCenarioAtendimentoController(
    request: FastifyRequest<{ Body: CriarCenarioAtendimento }>,
    reply: FastifyReply
) {
    try {
        const atendimento = await criarCenarioAtendimento(request.body);

        return reply.status(201).send({
            mensagem: "Atendimento do cenário criado com sucesso",
            atendimento
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar atendimento do cenário"
        );
    }
}
