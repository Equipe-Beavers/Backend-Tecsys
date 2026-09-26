import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarEstudoPonto } from "../models/estudo-ponto.js";
import { criarEstudoPonto } from "../services/estudo-ponto.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarEstudoPontoController(
    request: FastifyRequest<{
        Params: { id: number };
        Body: CriarEstudoPonto;
    }>,
    reply: FastifyReply
) {
    try {
        if (request.params.id !== request.body.id_estudo) {
            throw new Error("O estudo da URL deve ser igual ao estudo informado no corpo");
        }

        const ponto = await criarEstudoPonto(request.body);

        return reply.status(201).send({
            mensagem: "Ponto adicionado ao estudo com sucesso",
            ponto
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar ponto"
        );
    }
}
