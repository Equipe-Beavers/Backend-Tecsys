import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../database/supabase.js";
import { ApplicationService } from "../services/ApplicationService.js";

export class ApplicationController {
    private applicationService: ApplicationService;
    constructor(){
        this.applicationService = new ApplicationService();
    }

    async ListRegister(request: FastifyRequest, reply: FastifyReply) {
        try {
            // const data = await this.applicationService.listRegisters()

        } catch (error: any){
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao listar os registros"
            })
        }
    }
}