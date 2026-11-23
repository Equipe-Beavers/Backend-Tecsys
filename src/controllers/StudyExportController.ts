import type { FastifyReply, FastifyRequest } from "fastify";
import type { StudyExportQuery } from "../interface/StudyExportDTO.js";
import { StudyExportService } from "../services/StudyExportService.js";
import { StudyError } from "../utils/StudyError.js";

export class StudyExportController {
    private studyExportService: StudyExportService;

    constructor() {
        this.studyExportService = new StudyExportService();
    }

    async ExportStudyPdf(
        request: FastifyRequest<{ Params: { id: number }; Body: StudyExportQuery | null }>,
        reply: FastifyReply,
    ) {
        try {
            const file = await this.studyExportService.exportPdf(
                request.params.id,
                Number(request.user.sub),
                request.body ?? {},
            );
            return reply
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", `attachment; filename="${file.fileName}"`)
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .header("Cache-Control", "no-store")
                .send(file.content);
        } catch (error) {
            if (error instanceof StudyError) return reply.status(error.statusCode).send({ message: error.message });
            request.log.error({ err: error }, "Falha ao exportar resultados do estudo");
            return reply.status(500).send({ message: "Não foi possível gerar o arquivo de exportação do estudo." });
        }
    }
}
