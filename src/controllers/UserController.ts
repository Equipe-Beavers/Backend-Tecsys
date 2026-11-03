import type { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "../services/UserService.js";
import type { CriarUsuario } from "../interface/usuario.js";
import { AuthError } from "../utils/AuthError.js";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    async CreateUser(request: FastifyRequest<{Body: CriarUsuario}>, reply: FastifyReply) {
        reply.header("Cache-Control", "no-store");
        try {
            const data = await this.userService.createUser(request.body);
            return reply.status(201).send({
                message: "Usuário criado com sucesso!",
                data
            })
        } catch (error) {
            if (error instanceof AuthError) {
                return reply.status(error.statusCode).send({ code: error.code, message: error.message });
            }
            request.log.error({ err: error }, "Falha ao cadastrar usuário");
            return reply.status(500).send({ code: "INTERNAL_ERROR", message: "Não foi possível cadastrar o usuário." });
        }
    }
}
