export const criarEstudoSchema = {
  body: {
    type: "object",
    required: [
      "id_usuario",
      "nome",
      "status"
    ],

    additionalProperties: false,

    properties: {
      id_usuario: {
        type: "integer",
        minimum: 1
      },

      id_area_interesse: {
        anyOf: [
          {
            type: "integer",
            minimum: 1
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
        type: ["string", "null"]
      },

      distribuidora: {
        type: ["string", "null"],
        maxLength: 150
      },

      nome_base_externa: {
        type: ["string", "null"],
        maxLength: 255
      },

      versao_bdgd: {
        type: ["string", "null"],
        maxLength: 100
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
} as const;