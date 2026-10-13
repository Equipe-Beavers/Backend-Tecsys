import type { FastifyReply, FastifyRequest } from "fastify";
import { BuildingService } from "../services/BuildingService.js";
import type {
    CalculateObstructionDTO,
    ImportBuildingsDTO,
    ListBuildingsDTO,
    UpdateBuildingDTO,
    UpdateBuildingMaterialDTO,
} from "../interface/BuildingDTO.js";

export class BuildingController {
    private buildingService: BuildingService;

    constructor() {
        this.buildingService = new BuildingService();
    }

    async ListBuildings(request: FastifyRequest<{ Querystring: ListBuildingsDTO }>, reply: FastifyReply) {
        try {
            const { data, total } = await this.buildingService.listBuildings(request.query);

            if (request.query.format === "geojson") {
                return reply.status(200).send({
                    type: "FeatureCollection",
                    total,
                    features: data.map(({ geometria, ...properties }) => ({
                        type: "Feature",
                        id: properties.id_edificacao,
                        geometry: geometria,
                        properties,
                    })),
                });
            }

            return reply.status(200).send({ data, total });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao listar edificações.",
            });
        }
    }

    async ImportBuildings(request: FastifyRequest<{ Body: ImportBuildingsDTO }>, reply: FastifyReply) {
        try {
            const data = await this.buildingService.importBuildings(request.body);
            return reply.status(200).send({
                message: data.ja_importada
                    ? "As edificações dessa área já estavam importadas."
                    : "Edificações importadas com sucesso!",
                data,
            });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao importar edificações.",
            });
        }
    }

    async ImportStudyBuildings(
        request: FastifyRequest<{ Params: { id: number }; Body: { force?: boolean } | undefined }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.buildingService.importStudyBuildings(request.params.id, request.body?.force ?? false);
            return reply.status(200).send({
                message: data.ja_importada
                    ? "As edificações da área do estudo já estavam importadas."
                    : "Edificações da área do estudo importadas com sucesso!",
                data,
            });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao importar edificações do estudo.",
            });
        }
    }

    async GetBuilding(
        request: FastifyRequest<{ Params: { id: number }; Querystring: { frequencyMhz?: number } }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.buildingService.getBuilding(request.params.id, request.query.frequencyMhz);
            return reply.status(200).send({ data });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao buscar edificação.",
            });
        }
    }

    async UpdateBuilding(
        request: FastifyRequest<{ Params: { id: number }; Body: UpdateBuildingDTO }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.buildingService.updateBuilding(request.params.id, request.body);
            return reply.status(200).send({
                message: "Edificação atualizada com sucesso!",
                data,
            });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao atualizar edificação.",
            });
        }
    }

    async ListBuildingMaterials(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await this.buildingService.listBuildingMaterials();
            return reply.status(200).send({ data });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao listar materiais.",
            });
        }
    }

    async UpdateBuildingMaterial(
        request: FastifyRequest<{ Params: { code: string }; Body: UpdateBuildingMaterialDTO }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.buildingService.updateBuildingMaterial(request.params.code, request.body);
            return reply.status(200).send({
                message: "Material atualizado com sucesso!",
                data,
            });
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao atualizar material.",
            });
        }
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
            return reply.status(400).send({
                message: error.message || "Erro inesperado ao calcular obstrução.",
            });
        }
    }
}
