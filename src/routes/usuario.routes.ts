import type { FastifyInstance } from "fastify";

import type { CriarUsuario, Usuario } from "../models/usuario.js";
import { criarUsuarioController } from "../controllers/usuario.controller.js";
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
        criarUsuarioController
    );
}