import type { FastifyReply, FastifyRequest } from "fastify";

import type { CriarUsuario } from "../models/usuario.js";
import { criarUsuario } from "../services/usuario.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export async function criarUsuarioController(
    request: FastifyRequest<{ Body: CriarUsuario }>,
    reply: FastifyReply
) {
    try {
        const usuario = await criarUsuario(request.body);

        return reply.status(201).send({
            mensagem: "Usuário criado com sucesso",
            usuario
        });
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao criar usuário"
        );
    }
}
