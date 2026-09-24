import type { FastifyInstance } from "fastify";

import type { CriarUsuario, Usuario } from "../models/usuario.js";
import { criarUsuario } from "../services/usuario.service.js";
import { registrarRotasCrud } from "./crud.routes.js";

export async function usuarioRoutes(fastify: FastifyInstance) {
    registrarRotasCrud<Usuario>(fastify, {
        caminho: "/usuarios",
        tabela: "usuarios",
        colunaId: "id_usuario",
        entidade: "Usuário",
        chaveResposta: "usuarios"
    });

    fastify.post<{ Body: CriarUsuario }>(
        "/usuarios",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["username", "email", "senha_hash"],
                    additionalProperties: false,
                    properties: {
                        username: { type: "string", minLength: 1 },
                        email: { type: "string", minLength: 3 },
                        senha_hash: { type: "string", minLength: 1 }
                    }
                }
            }
        },
        async (request, reply) => {
            try {
                const usuario = await criarUsuario(request.body);
                return reply.status(201).send({
                    mensagem: "Usuário criado com sucesso",
                    usuario
                });
            } catch (error) {
                const mensagem = error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao criar usuário";
                fastify.log.error(error);
                return reply.status(400).send({ erro: mensagem });
            }
        }
    );
}