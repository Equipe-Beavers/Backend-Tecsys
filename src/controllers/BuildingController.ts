import type { FastifyReply, FastifyRequest } from "fastify";
import { BuildingService, BuildingSourceError } from "../services/BuildingService.js";
import type { CalculateObstructionDTO, ListBuildingsDTO } from "../interface/BuildingDTO.js";

/** 503 quando a fonte externa falha; 400 para erros de validação. */
function errorStatus(error: unknown): number {
    return error instanceof BuildingSourceError ? error.statusCode : 400;
}

export class BuildingController {
    private buildingService: BuildingService;

    constructor() {
        this.buildingService = new BuildingService();
    }

    async ListBuildings(request: FastifyRequest<{ Querystring: ListBuildingsDTO }>, reply: FastifyReply) {
        try {
            const { data, total, fonte, versao_fonte } = await this.buildingService.listBuildings(request.query);

            if (request.query.format === "geojson") {
                return reply.status(200).send({
                    type: "FeatureCollection",
                    total,
                    fonte,
                    versao_fonte,
                    features: data.map(({ geometria, ...properties }) => ({
                        type: "Feature",
                        id: properties.id,
                        geometry: geometria,
                        properties,
                    })),
                });
            }

            return reply.status(200).send({ data, total, fonte, versao_fonte });
        } catch (error: any) {
            return reply.status(errorStatus(error)).send({
                message: error.message || "Erro inesperado ao listar edificações.",
            });
        }
    }

    async ListBuildingMaterials(_request: FastifyRequest, reply: FastifyReply) {
        return reply.status(200).send({ data: this.buildingService.listBuildingMaterials() });
    }

    async CalculateBuildingObstruction(
        request: FastifyRequest<{ Body: CalculateObstructionDTO }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.buildingService.calculateBuildingObstruction(request.body);
            return reply.status(200).send({
                frequency_mhz: request.body.frequency_mhz,
                data,
            });
        } catch (error: any) {
            return reply.status(errorStatus(error)).send({
                message: error.message || "Erro inesperado ao calcular obstrução.",
            });
        }
    }
}
