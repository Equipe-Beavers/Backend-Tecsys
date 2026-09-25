import type { FastifyInstance } from "fastify";
import {
    assetTypes,
    findAssetById,
    findDistributors,
    findAssets,
    findDeviceTypes,
    type AssetType,
} from "./ativo.repository.js";

interface ListQuery {
    minLatitude?: string;
    maxLatitude?: string;
    minLongitude?: string;
    maxLongitude?: string;
    tipos?: string;
    distribuidoras?: string;
    limit?: string;
    tiposDispositivos?: string;
}

interface DetailParams {
    id: string;
}

function parseCoordinate(value: string | undefined, name: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Parâmetro '${name}' deve ser numérico.`);
    }
    return parsed;
}

function parseTypes(value: string | undefined): AssetType[] | undefined {
    if (!value) return undefined;
    const types = value.split(",").map((type) => type.trim().toUpperCase());
    if (types.length === 0 || types.some((type) => !assetTypes.includes(type as AssetType))) {
        throw new Error(`Tipos inválidos. Valores permitidos: ${assetTypes.join(", ")}.`);
    }

    return types as AssetType[];
}

function parseLimit(value: string | undefined): number {
    if (value === undefined) return 500;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        throw new Error("Parâmetro 'limit' deve ser um inteiro entre 1 e 5000.");
    }

    return limit;
}

function parseDeviceTypeIds(value: string | undefined): number[] | undefined {
    if (!value) return undefined;
    const ids = value.split(",").map((item) => Number(item.trim()));
    if (
        ids.length === 0 ||
        ids.some((id) => !Number.isInteger(id) || id < 0 || id > 43)
    ) {
        throw new Error("Tipos de dispositivos inválidos. Use códigos inteiros entre 0 e 43.");
    }
    return ids;
}

function parseDistributors(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const values = value.split(",").map((item) => item.trim());
    if (values.length === 0 || values.some((item) => item.length === 0)) {
        throw new Error("Distribuidoras inválidas.");
    }
    return values;
}

export async function ativoRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/ativos/distribuidoras", async (request, reply) => {
        try {
            return reply.send({ data: await findDistributors() });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: "Não foi possível consultar as distribuidoras." });
        }
    });

    app.get("/api/ativos/tipos-dispositivos", async (request, reply) => {
        try {
            return reply.send({ data: await findDeviceTypes() });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: "Não foi possível consultar os tipos de dispositivos." });
        }
    });

    app.get<{ Querystring: ListQuery }>("/api/ativos", async (request, reply) => {
        try {
            const minLatitude = parseCoordinate(request.query.minLatitude, "minLatitude");
            const maxLatitude = parseCoordinate(request.query.maxLatitude, "maxLatitude");
            const minLongitude = parseCoordinate(request.query.minLongitude, "minLongitude");
            const maxLongitude = parseCoordinate(request.query.maxLongitude, "maxLongitude");

            if (
                minLatitude > maxLatitude ||
                minLongitude > maxLongitude ||
                minLatitude < -90 ||
                maxLatitude > 90 ||
                minLongitude < -180 ||
                maxLongitude > 180
            ) {
                return reply.code(400).send({ error: "Bounding box inválido." });
            }

            const { items, total } = await findAssets({
                minLatitude,
                maxLatitude,
                minLongitude,
                maxLongitude,
                types: parseTypes(request.query.tipos),
                deviceTypeIds: parseDeviceTypeIds(request.query.tiposDispositivos),
                distributors: parseDistributors(request.query.distribuidoras),
                limit: parseLimit(request.query.limit),
            });
            return reply.send({ data: items, total });
        } catch (error) {
            if (error instanceof Error && error.message.startsWith("Parâmetro")) {
                return reply.code(400).send({ error: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Tipos")) {
                return reply.code(400).send({ error: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Distribuidoras")) {
                return reply.code(400).send({ error: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Tipos de dispositivos")) {
                return reply.code(400).send({ error: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Parâmetro 'limit'")) {
                return reply.code(400).send({ error: error.message });
            }
            request.log.error(error);
            return reply.code(500).send({ error: "Não foi possível consultar os ativos." });
        }
    });

    app.get<{ Params: DetailParams }>("/api/ativos/:id", async (request, reply) => {
        try {
            const ativo = await findAssetById(request.params.id);
            if (!ativo) {
                return reply.code(404).send({ error: "Ativo não encontrado." });
            }
            return reply.send(ativo);
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: "Não foi possível consultar o ativo." });
        }
    });
}
