import type { FastifyReply, FastifyRequest } from "fastify";
import { ActiveService } from "../services/ActiveService.js";
import type { DetailParams, ListQuery } from "../interface/active-repository.js";
import { ActiveUtils } from "../utils/ActiveUtils.js";

export class ActiveController {
    private activeUtils: ActiveUtils;
    private activeService: ActiveService;

    constructor() {
        this.activeUtils = new ActiveUtils();
        this.activeService = new ActiveService();
    }

    async FindDistributors(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await this.activeService.findDistributors();
            return reply.status(200).send({
                data
            });
        } catch (error: any) {
            return reply.status(500).send({
                message: error.message || "Não foi possível consultar as distribuidoras."
            });
        }
    }

    async FindDeviceTypes(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await this.activeService.findDeviceTypes();
            return reply.status(200).send({
                data
            })
        } catch (error: any) {
            return reply.status(500).send({
                message: error.message || "Não foi possível consultar os tipos de dispositivos."
            })
        }
    }

    async FindAssets(request: FastifyRequest <{Querystring: ListQuery}>, reply: FastifyReply) {
        try {
            const minLat = this.activeUtils.parseCoordinate(request.query.minLatitude, "minLatitude");
            const maxLat = this.activeUtils.parseCoordinate(request.query.maxLatitude, "maxLatitude");
            const minLng = this.activeUtils.parseCoordinate(request.query.minLongitude, "minLongitude");
            const maxLng = this.activeUtils.parseCoordinate(request.query.maxLongitude, "maxLongitude");

            if (minLat > maxLat || minLng > maxLng || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return reply.status(400).send({ message: "Bounding Box inválido" });
            const {items, total} = await this.activeService.findAssets({
                minLatitude: minLat,
                maxLatitude: maxLat,
                minLongitude: minLng,
                maxLongitude: maxLng,
                types: this.activeUtils.parseTypes(request.query.tipos),
                deviceTypeIds: this.activeUtils.parseDeviceTypeIds(request.query.tiposDispositivos),
                distributors: this.activeUtils.parseDistributors(request.query.distribuidoras),
                municipio: request.query.municipio,
                bairro: request.query.bairro,
                limit: this.activeUtils.parseLimit(request.query.limit)
            });
            return reply.status(200).send({ data: items, total});
        } catch (error: any) {
            if (error instanceof Error && error.message.startsWith("Parâmetro")) {
                return reply.code(400).send({ message: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Tipos")) {
                return reply.code(400).send({ message: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Distribuidoras")) {
                return reply.code(400).send({ message: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Tipos de dispositivos")) {
                return reply.code(400).send({ message: error.message });
            }
            if (error instanceof Error && error.message.startsWith("Parâmetro 'limit'")) {
                return reply.code(400).send({ message: error.message });
            }
            request.log.error(error);
            return reply.code(500).send({ message: "Não foi possível consultar os ativos." });
        }
    }

    async FindAssetById(request: FastifyRequest <{Params: DetailParams}>, reply: FastifyReply) {
        try {
            const active = await this.activeService.findAssetById(request.params.id);
            if (!active) return reply.status(404).send({ message: "Ativo não encontrado." });
            return reply.status(200).send({active});
        } catch (error: any) {
            return reply.status(500).send({
                message: error.message || "Não foi possível consultar os ativos."
            });
        }
    }
}
