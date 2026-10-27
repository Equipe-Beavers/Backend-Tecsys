import type { FastifyReply, FastifyRequest } from "fastify";
import { RegionsService } from "../services/RegionsService.js";
import { RegionsUtils } from "../utils/RegionsUtils.js";

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

type DistributorResolution = {
    nome?: string;
    erro?: { status: number; mensagem: string };
};

export class RegionsController {
    private readonly regionsUtils: RegionsUtils;
    private readonly regionsService: RegionsService;

    constructor() {
        this.regionsUtils = new RegionsUtils();
        this.regionsService = new RegionsService();
    }

    private async SolveDistributor(distribuidora?: string, dsitribuidoraID?: string): Promise<{ nome?: string, erro?: { status: number; mensagem: string} }>{
        const distName = distribuidora?.trim();
        if (distName) return {nome: distName};
        if (dsitribuidoraID === undefined) return {};
        const id = Number(dsitribuidoraID);
        if (!Number.isInteger(id) || id < 1) return { erro: {status: 400, mensagem: "ID de distribuidora inválido."}}
        const name = await this.regionsService.distributorName(id);
        if (!name) return { erro: {status: 404, mensagem: `Distribuidora ${id} não encontrada`}};
        return { nome: name };
    }

    async ListDistributor(
        request: FastifyRequest<{ Querystring: { busca?: string } }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.regionsService.listDistributors(request.query.busca);
            return reply.status(200).send(data);
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Um erro inesperado ocorreu ao listar as distribuidoras.",
            });
        }
    }

    async ListStates(
        request: FastifyRequest<{ Querystring: { busca?: string } }>,
        reply: FastifyReply,
    ) {
        try {
            const data = await this.regionsService.listStates(request.query.busca);
            return reply.status(200).send(data);
        } catch (error: any) {
            return reply.status(400).send({
                message:  error.message ||  "Um erro inesperado ocorreu ao listar os estados.",
            });
        }
    }

    async ListMunicipios(request: FastifyRequest<{Querystring: {distribuidora?: string, distribuidoraId?: string, uf?: string, busca?: string, limite?: string, pagina?: string, minLat?: string, maxLat?: string, minLng?: string, maxLng?: string}}>, reply: FastifyReply) {
        try {
            const {distribuidora, distribuidoraId, uf, busca} = request.query;
            const limit = Math.min(
                Math.max(Number(request.query.limite) || LIMITE_PADRAO, 1),
                LIMITE_MAXIMO
            );
            const page = this.regionsUtils.paginaEValida(request.query.pagina);
            const bbox = this.regionsUtils.boundingBox(request.query);
            const informedBbox = [request.query.minLat, request.query.maxLat, request.query.minLng, request.query.maxLng].some(Boolean);
            const paginatedAnswer = request.query.pagina !== undefined || informedBbox;
            if (informedBbox && !bbox) return reply.status(400).send({ erro: "Bounding Box inválido. Informe de forma válida os seguintes valores: minLat, maxLat, minLng, maxLng"});
            const resolution =  await this.SolveDistributor(distribuidora, distribuidoraId);
            if (resolution.erro) return reply.status(resolution.erro.status).send({ erro: resolution.erro.mensagem });
            if (!resolution.nome) {
                if (!busca?.trim() && !uf?.trim()) return reply.status(400).send({ erro: "Informe distribuidora, UF ou um termo de busca."});
                const result = await this.regionsService.findGlobalMun({ busca, uf, limite: limit, pagina: page, bbox});
                return paginatedAnswer ? result : result.dados;
            }
            const result = await this.regionsService.listMunicipio({distribuidora: resolution.nome, uf, busca, limite: limit, pagina: page, bbox});
            return paginatedAnswer ? result : result.dados;
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Um erro inesperado ocorreu ao listas os municípios."
            })
        }
    }

    async ListNeighborhood(request: FastifyRequest<{ Querystring: { distribuidora?: string, distribuidoraId?: string, municipio?: string, busca?: string, limite?: string, pagina?: string}}>, reply: FastifyReply) {
        try {
            const { distribuidora, distribuidoraId, municipio, busca } = request.query;
            const limit = Math.min(
                Math.max(Number(request.query.limite) || LIMITE_PADRAO, 1),
                LIMITE_MAXIMO
            );
            const page = this.regionsUtils.paginaEValida(request.query.pagina);
            const paginatedAnswer = request.query.pagina !== undefined;
            const resolution = await this.SolveDistributor(distribuidora, distribuidoraId);
            if (resolution.erro) return reply.status(resolution.erro.status).send({ erro: resolution.erro.mensagem });
            const result = await this.regionsService.listNeighborhood({distribuidora: resolution.nome, municipio, busca, limite: limit, pagina: page});
            return paginatedAnswer ? result : result.dados;
        } catch (error: any) {
            return reply.status(400).send({
                message: error.message || "Um erro inesperado ocorreu ao listar os bairros."
            })
        }
    }
}