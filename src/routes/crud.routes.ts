import type { FastifyInstance } from "fastify";

import {
    atualizarRegistro,
    buscarRegistroPorId,
    excluirRegistro,
    listarRegistros
} from "../services/crud.service.js";

interface ConfiguracaoCrud {
    caminho: string;
    tabela: string;
    colunaId: string;
    entidade: string;
    chaveResposta: string;
}

const schemaId = {
    params: {
        type: "object",
        required: ["id"],
        additionalProperties: false,
        properties: {
            id: { type: "integer", minimum: 1 }
        }
    }
};

const schemaAtualizacao = {
    ...schemaId,
    body: {
        type: "object",
        minProperties: 1,
        additionalProperties: true
    }
};

function tratarErro(fastify: FastifyInstance, error: unknown) {
    const mensagem = error instanceof Error
        ? error.message
        : "Erro desconhecido";

    fastify.log.error(error);
    return { erro: mensagem };
}

export function registrarRotasCrud<T>(
    fastify: FastifyInstance,
    configuracao: ConfiguracaoCrud
): void {
    const {
        caminho,
        tabela,
        colunaId,
        entidade,
        chaveResposta
    } = configuracao;

    fastify.get(caminho, async (_request, reply) => {
        try {
            const registros = await listarRegistros<T>(tabela);
            return reply.send({ [chaveResposta]: registros });
        } catch (error) {
            return reply.status(400).send(tratarErro(fastify, error));
        }
    });

    fastify.get<{ Params: { id: number } }>(
        `${caminho}/:id`,
        { schema: schemaId },
        async (request, reply) => {
            try {
                const registro = await buscarRegistroPorId<T>(
                    tabela,
                    colunaId,
                    request.params.id,
                    entidade
                );

                return reply.send({ [chaveResposta]: registro });
            } catch (error) {
                return reply.status(400).send(tratarErro(fastify, error));
            }
        }
    );

    fastify.patch<{
        Params: { id: number };
        Body: Record<string, unknown>;
    }>(
        `${caminho}/:id`,
        { schema: schemaAtualizacao },
        async (request, reply) => {
            try {
                const registro = await atualizarRegistro<T>(
                    tabela,
                    colunaId,
                    request.params.id,
                    request.body,
                    entidade
                );

                return reply.send({
                    mensagem: `${entidade} atualizado com sucesso`,
                    [chaveResposta]: registro
                });
            } catch (error) {
                return reply.status(400).send(tratarErro(fastify, error));
            }
        }
    );

    fastify.delete<{ Params: { id: number } }>(
        `${caminho}/:id`,
        { schema: schemaId },
        async (request, reply) => {
            try {
                await excluirRegistro(
                    tabela,
                    colunaId,
                    request.params.id,
                    entidade
                );

                return reply.send({
                    mensagem: `${entidade} excluído com sucesso`
                });
            } catch (error) {
                return reply.status(400).send(tratarErro(fastify, error));
            }
        }
    );
}