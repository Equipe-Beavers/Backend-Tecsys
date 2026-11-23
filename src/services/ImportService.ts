import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { request } from "undici";

export class ImportService {
    constructor(private readonly pythonService = "http://localhost:8000/process-file") {}

    async importFile(file: MultipartFile, bdgd_version: string) {
        const allowedFiles = [".zip", ".gdb"];

        const isFileValid = allowedFiles.some(end => file.filename.toLowerCase().endsWith(end));
        if (!isFileValid) {
            throw new Error("Formato de arquivo inválido. Apenas arquivos '.zip' e '.gdb' são permitidos.");
        }

        const boundary = `----tecsys-${randomUUID()}`;
        const safeFilename = file.filename.replace(/["\\\r\n]/g, "_");
        const body = async function* () {
            yield Buffer.from(
                `--${boundary}\r\n` +
                'Content-Disposition: form-data; name="bdgd_version"\r\n\r\n' +
                `${bdgd_version}\r\n` +
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="${safeFilename}"\r\n` +
                "Content-Type: application/octet-stream\r\n\r\n",
            );
            for await (const chunk of file.file) {
                yield chunk;
            }
            yield Buffer.from(`\r\n--${boundary}--\r\n`);
        };

        const response = await request(this.pythonService, {
            method: "POST",
            headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
            body: Readable.from(body()),
        });

        if (response.statusCode !== 200) {
            const errorText = await response.body.text();
            throw new Error(`Erro no microsserviço Python: ${errorText}`);
        }

        const data = await response.body.json();
        return data;
    }
}