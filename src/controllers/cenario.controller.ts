import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarCenario } from "../models/cenario.js";
import { criarCenario } from "../services/cenario.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarCenarioController(
    request: FastifyRequest<{ Body: CriarCenario }>,
    reply: FastifyReply
) {
    try {
        const cenario = await criarCenario(request.body);

        return reply.status(201).send({
            mensagem: "Cenário criado com sucesso",
            cenario
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar cenário"
        );
    }
}
