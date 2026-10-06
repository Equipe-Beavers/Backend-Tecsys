import type { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "../services/UserService.js";
import type { CriarUsuario } from "../interface/usuario.js";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    async CreateUser(request: FastifyRequest<{Body: CriarUsuario}>, reply: FastifyReply) {
        try {
            const data = await this.userService.createUser(request.body);
            return reply.status(201).send({
                message: "Usuário criado com sucesso!",
                data
            })
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao criar usuário."
            })
        }
    }
}