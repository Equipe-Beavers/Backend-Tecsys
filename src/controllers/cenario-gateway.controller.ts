import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarCenarioGateway } from "../models/cenario-gateway.js";
import { criarCenarioGateway } from "../services/cenario-gateway.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarCenarioGatewayController(
    request: FastifyRequest<{ Body: CriarCenarioGateway }>,
    reply: FastifyReply
) {
    try {
        const gateway = await criarCenarioGateway(request.body);

        return reply.status(201).send({
            mensagem: "Gateway do cenário criado com sucesso",
            gateway
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar gateway do cenário"
        );
    }
}
