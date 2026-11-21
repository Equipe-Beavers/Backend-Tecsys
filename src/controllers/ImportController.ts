import type { FastifyReply, FastifyRequest } from "fastify";
import { ImportService } from "../services/ImportService.js";

export class ImportController {
    private importService: ImportService;
    constructor() {
        this.importService = new ImportService()
    }

    async ImportFile(request: FastifyRequest, reply: FastifyReply) {
        try {
            const file = await request.file()
            if (!file) return reply.status(400).send({message: "Nenhum arquivo encontrado."});
            
            const fields = file.fields as Record<string, any>;
            const bdgdVersion = fields?.bdgd_version?.value;
            if (!bdgdVersion) return reply.status(400).send({ message: "A versão da BDGD (bdgd_version) é obrigatória." });

            const json_data = await this.importService.importFile(file, bdgdVersion)
            return reply.status(200).send(json_data)
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Ocorreu um erro ao importar o arquivo."
            })
        }
    }
}