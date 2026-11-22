import type { MultipartFile } from "@fastify/multipart";
import { request, FormData } from "undici";
import { Readable } from "node:stream";

export class ImportService {
    async importFile(file: MultipartFile, bdgd_version: string) {
        const allowedFiles = [".zip", ".gdb"];

        const isFileValid = allowedFiles.some(end => file.filename.toLocaleLowerCase().endsWith(end));
        if (!isFileValid) {
            throw new Error("Formato de arquivo inválido. Apenas arquivos '.zip' e '.gdb' são permitidos.");
        }

        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        const blob = new Blob([fileBuffer]);

        const formData = new FormData();
        formData.set("file", blob, file.filename);
        formData.set("bdgd_version", bdgd_version);

        const pythonService = "http://localhost:8000/process-file";
        const response = await request(pythonService, {
            method: "POST",
            body: formData,
        });

        if (response.statusCode !== 200) {
            const errorText = await response.body.text();
            throw new Error(`Erro no microsserviço Python: ${errorText}`);
        }

        const data = await response.body.json();
        return data;
    }
}