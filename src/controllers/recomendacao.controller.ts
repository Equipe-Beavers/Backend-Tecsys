import type { FastifyReply, FastifyRequest } from "fastify";

import { gerarRecomendacao } from "../services/recomendacao/recomendacao.service.js";
import { tratarErroHttp } from "./tratar-erro.js";

export interface RecomendarParams {
    id: number;
}

export interface RecomendarBody {
    id_perfil_rf: number;
    id_criterio_instalacao?: number | null;
    nome_cenario?: string;
}

export async function gerarRecomendacaoController(
    request: FastifyRequest<{
        Params: RecomendarParams;
        Body: RecomendarBody;
    }>,
    reply: FastifyReply
) {
    try {
        const resultado = await gerarRecomendacao({
            id_estudo: request.params.id,
            id_perfil_rf: request.body.id_perfil_rf,
            id_criterio_instalacao: request.body.id_criterio_instalacao ?? null,
            nome_cenario: request.body.nome_cenario
        });

        return reply.status(201).send(resultado);
    } catch (error) {
        return tratarErroHttp(
            request,
            reply,
            error,
            "Erro desconhecido ao gerar recomendação"
        );
    }
}
