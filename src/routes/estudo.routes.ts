import type { FastifyInstance } from "fastify";

import type {
    CriarEstudo,
    Estudo
} from "../models/estudo.js";

import { criarEstudoController } from "../controllers/estudo.controller.js";

import {
    registrarRotasCrud
} from "./crud.routes.js";


export async function estudoRoutes(
    fastify: FastifyInstance
) {

    registrarRotasCrud<Estudo>(fastify, {
        caminho: "/estudos",
        tabela: "estudos",
        colunaId: "id_estudo",
        entidade: "Estudo",
        chaveResposta: "estudos"
    });

    fastify.post<{ Body: CriarEstudo }>(
        "/estudos",
        {
            schema: {
                body: {
                    type: "object",

                    required: [
                        "id_usuario",
                        "tipo_delimitacao",
                        "nome"
                    ],

                    additionalProperties: false,

                    properties: {

                        id_usuario: {
                            type: "integer",
                            minimum: 1
                        },

                        tipo_delimitacao: {
                            type: "string",
                            enum: [
                                "desenho",
                                "selecao",
                                "mancha"
                            ]
                        },

                        uf: {
                            anyOf: [
                                {
                                    type: "string",
                                    minLength: 2,
                                    maxLength: 2
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        municipio: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 120
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        bairro: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 120
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        geom: {
                            anyOf: [
                                {
                                    type: "object"
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        nome: {
                            type: "string",
                            minLength: 1,
                            maxLength: 150
                        },

                        descricao: {
                            anyOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        distribuidora: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 150
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        versao_bdgd: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 100
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        nome_base_externa: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 255
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        tipos_ativo_selecionados: {
                            anyOf: [
                                {
                                    type: "array",

                                    items: {
                                        type: "object",

                                        required: [
                                            "tipo_ativo",
                                            "papel",
                                            "quantidade"
                                        ],

                                        additionalProperties: false,

                                        properties: {

                                            tipo_ativo: {
                                                type: "string",
                                                minLength: 1
                                            },

                                            papel: {
                                                type: "string",
                                                enum: [
                                                    "candidato",
                                                    "interesse",
                                                    "ambos"
                                                ]
                                            },

                                            quantidade: {
                                                type: "integer",
                                                minimum: 0
                                            }
                                        }
                                    }
                                },

                                {
                                    type: "null"
                                }
                            ]
                        },

                        status: {
                            type: "string",

                            enum: [
                                "AGUARDANDO_SELECAO",
                                "DEFINITIVO",
                                "CRIANDO_CENARIO",
                                "CENARIO_EM_RASCUNHO",
                                "EM_COMPARACAO"
                            ]
                        }
                    }
                }
            }
        },
        criarEstudoController
    );
}