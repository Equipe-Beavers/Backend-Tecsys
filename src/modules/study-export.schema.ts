const mapImage = { type: ["string", "null"], maxLength: 10 * 1024 * 1024 };

export const STUDY_EXPORT_BODY_LIMIT = 40 * 1024 * 1024;

export const studyExportBodySchema = {
    type: ["object", "null"],
    additionalProperties: false,
    properties: {
        id_cenario: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
        incluir_alternativas: { type: "boolean", default: true },
        imagem_mapa: mapImage,
        imagens_mapa: {
            type: "object",
            maxProperties: 20,
            propertyNames: { pattern: "^[1-9][0-9]{0,15}$" },
            additionalProperties: mapImage,
        },
    },
};
