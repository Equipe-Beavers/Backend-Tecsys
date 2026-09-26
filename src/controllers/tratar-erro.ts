import type { FastifyReply, FastifyRequest } from "fastify";

export function tratarErroHttp(
    request: FastifyRequest,
    reply: FastifyReply,
    error: unknown,
    mensagemPadrao: string
) {
    const mensagem = error instanceof Error
        ? error.message
        : mensagemPadrao;

    request.log.error(error);
    return reply.status(400).send({ erro: mensagem });
}
