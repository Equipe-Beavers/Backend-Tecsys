export const studyExportBodySchema = {
    type: ["object", "null"],
    additionalProperties: false,
    properties: {
        id_cenario: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
        incluir_alternativas: { type: "boolean", default: false },
        imagem_mapa: { type: ["string", "null"], maxLength: 14 * 1024 * 1024 },
    },
};
