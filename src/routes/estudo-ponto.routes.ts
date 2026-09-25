import type { FastifyInstance } from "fastify";

import type {
    CriarEstudoPonto,
    EstudoPonto
} from "../models/estudo-ponto.js";

import { criarEstudoPontoController } from "../controllers/estudo-ponto.controller.js";

import {
    registrarRotasCrud
} from "./crud.routes.js";


export async function estudoPontoRoutes(
    fastify: FastifyInstance
) {

    registrarRotasCrud<EstudoPonto>(fastify, {
        caminho: "/estudo-pontos",
        tabela: "estudo_pontos",
        colunaId: "id_estudo_ponto",
        entidade: "Ponto do estudo",
        chaveResposta: "pontos"
    });

    fastify.post<{
        Params: { id: number };
        Body: CriarEstudoPonto;
    }>(
        "/estudos/:id/pontos",
        {
            schema: {
                params: {
                    type: "object",
                    required: ["id"],
                    additionalProperties: false,
                    properties: {
                        id: {
                            type: "integer",
                            minimum: 1
                        }
                    }
                },
                body: {
                    type: "object",

                    required: [
                        "id_estudo",
                        "origem",
                        "papel",
                        "latitude",
                        "longitude"
                    ],

                    additionalProperties: false,

                    properties: {

                        id_estudo: {
                            type: "integer",
                            minimum: 1
                        },

                        origem: {
                            type: "string",
                            enum: [
                                "bdgd",
                                "csv",
                                "manual"
                            ]
                        },

                        id_ativo_bdgd: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 60
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        tipo_ativo: {
                            anyOf: [
                                {
                                    type: "string",
                                    maxLength: 60
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        rotulo: {
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

                        papel: {
                            type: "string",
                            enum: [
                                "candidato",
                                "interesse",
                                "ambos"
                            ]
                        },

                        prioridade: {
                            anyOf: [
                                {
                                    type: "string",
                                    enum: [
                                        "normal",
                                        "alta",
                                        "critico"
                                    ]
                                },
                                {
                                    type: "null"
                                }
                            ]
                        },

                        latitude: {
                            type: "number",
                            minimum: -90,
                            maximum: 90
                        },

                        longitude: {
                            type: "number",
                            minimum: -180,
                            maximum: 180
                        },

                        atributos: {
                            anyOf: [
                                {
                                    type: "object"
                                },
                                {
                                    type: "null"
                                }
                            ]
                        }
                    }
                }
            }
        },
        criarEstudoPontoController
    );
}