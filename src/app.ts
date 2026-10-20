import fastify from "fastify";
import cors from "@fastify/cors";
import { UserController } from "./controllers/UserController.js";
import { StudyController } from "./controllers/StudyController.js";
import { ScenarioController } from "./controllers/ScenarioController.js";
import { InstallCriterionController } from "./controllers/InstallCriterionController.js";
import { RFController } from "./controllers/RFController.js";
import { RecommendationController } from "./controllers/RecommendationController.js";

export class App {
  public app: fastify.FastifyInstance;
  constructor() {
    this.app = fastify({ logger: true, ajv: { customOptions: { removeAdditional: false } } });
    // Flutter Web development origin; deployments can provide an explicit list.
    void this.app.register(cors, {
      origin: process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean)
        ?? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    });
    this.routes();
  }

  async listen(port: number) {
    try {
      await this.app.listen({ port: port, host: "0.0.0.0" });
      console.log(`O servidor está rodando na porta ${port}`);
    } catch (error: any) {
      this.app.log.error(error);
      process.exit(1);
    }
  }

  public getInstance() {
    return this.app;
  }

  routes() {
    const userController = new UserController();
    const studyController = new StudyController();
    const scenarioController = new ScenarioController();
    const installCriterionController = new InstallCriterionController();
    const rfControler = new RFController();
    const recommendationController = new RecommendationController();

    this.app.post("/create-user", async (request, reply) => {
      await userController.CreateUser(
        request as Parameters<UserController["CreateUser"]>[0],
        reply,
      );
    });

    // ROTAS DE ESTUDO E RECOMENDAÇÃO
    const studyId = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
    const optionalStudyText = (maxLength: number) => ({ type: ["string", "null"], maxLength });
    const studySchema = { body: {
      type: "object",
      required: ["id_usuario", "id_perfil_rf", "id_criterio_instalacao", "tipo_delimitacao", "nome"],
      additionalProperties: false,
      properties: {
        id_usuario: studyId,
        id_perfil_rf: studyId,
        id_criterio_instalacao: studyId,
        tipo_delimitacao: { type: "string", enum: ["desenho", "selecao", "mancha"] },
        nome: { type: "string", minLength: 1, maxLength: 150, pattern: "\\S" },
        descricao: { type: ["string", "null"] },
        uf: { type: ["string", "null"], minLength: 2, maxLength: 2 },
        municipio: optionalStudyText(120),
        bairro: optionalStudyText(120),
        distribuidora: optionalStudyText(150),
        versao_bdgd: optionalStudyText(120),
        nome_base_externa: optionalStudyText(150),
        geom: { type: ["object", "null"] },
        tipos_ativo_selecionados: { type: ["array", "null"], items: {
          type: "object", required: ["tipo_ativo", "papel", "quantidade"], additionalProperties: false,
          properties: {
            tipo_ativo: { type: "string", minLength: 1 },
            papel: { type: "string", enum: ["candidato", "interesse", "ambos"] },
            quantidade: { type: "integer", minimum: 0 },
          },
        } },
        status: { type: "string", enum: ["AGUARDANDO_SELECAO", "DEFINITIVO", "CRIANDO_CENARIO", "CENARIO_EM_RASCUNHO", "EM_COMPARACAO"] },
      },
    } };
    this.app.get("/estudos", { schema: { querystring: {
      type: "object", additionalProperties: false,
      properties: { id_usuario: studyId },
    } } }, async (request, reply) => {
      return studyController.ListStudies(
        request as Parameters<StudyController["ListStudies"]>[0], reply,
      );
    });
    this.app.post("/estudos", { schema: studySchema }, async (request, reply) => {
      return studyController.CreateStudy(
        request as Parameters<StudyController["CreateStudy"]>[0], reply,
      );
    });
    this.app.post("/create-study", { schema: studySchema }, async (request, reply) => {
      await studyController.CreateStudy(
        request as Parameters<StudyController["CreateStudy"]>[0],
        reply,
      );
    });

    const studyParams = {
      type: "object", required: ["id"], additionalProperties: false,
      properties: { id: studyId },
    };
    this.app.get("/estudos/:id", { schema: { params: studyParams } }, async (request, reply) => {
      return studyController.GetStudy(request as Parameters<StudyController["GetStudy"]>[0], reply);
    });
    this.app.patch("/estudos/:id", { schema: { params: studyParams, body: {
      type: "object", minProperties: 1, additionalProperties: false,
      properties: {
        nome: studySchema.body.properties.nome,
        descricao: studySchema.body.properties.descricao,
        uf: studySchema.body.properties.uf,
        municipio: studySchema.body.properties.municipio,
        bairro: studySchema.body.properties.bairro,
        id_perfil_rf: studyId,
        id_criterio_instalacao: studyId,
      },
    } } }, async (request, reply) => {
      return studyController.UpdateStudy(request as Parameters<StudyController["UpdateStudy"]>[0], reply);
    });
    this.app.delete("/estudos/:id", { schema: { params: studyParams } }, async (request, reply) => {
      return studyController.DeleteStudy(request as Parameters<StudyController["DeleteStudy"]>[0], reply);
    });

    this.app.post("/study/:id/points", async (request, reply) => {
      await studyController.CreateStudyPoint(
        request as Parameters<StudyController["CreateStudyPoint"]>[0],
        reply,
      );
    });

    this.app.post("/study/:id/recommendation", async (request, reply) => {
      await recommendationController.GenerateRecommendation(
        request as Parameters<RecommendationController["GenerateRecommendation"]>[0],
        reply
      )
    })

    // ROTAS DE CENÁRIO
    this.app.post("/create-scenario", async (request, reply) => {
      await scenarioController.CreateScneario(
        request as Parameters<ScenarioController["CreateScneario"]>[0],
        reply,
      );
    });

    this.app.post("/create-service-scenario", async (request, reply) => {
        await scenarioController.CreateServiceScenario(
            request as Parameters<ScenarioController["CreateServiceScenario"]>[0], 
            reply
        );
    });

    this.app.post("/create-gateway-scenario", async (request, reply) => {
        await scenarioController.CreateGatewayScenario(
            request as Parameters<ScenarioController["CreateGatewayScenario"]>[0],
            reply
        );
    });

    // InstallCriterionController
    const criterionId = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
    const criterionParams = {
      type: "object", required: ["id"], additionalProperties: false,
      properties: { id: criterionId },
    };
    const criterionProperties = {
      id_usuario: criterionId,
      nome: { type: "string", minLength: 1, maxLength: 150, pattern: "\\S" },
      // JSONB shape is not prescribed by the approved model.
      tipos_elementos_permitidos: {},
      tipos_elementos_proibidos: {},
      requer_alimentacao_eletrica: { type: ["boolean", "null"] },
      distancia_minima_ativos_m: { type: ["number", "null"], minimum: 10, maximum: 500 },
      distancia_maxima_ativos_m: { type: ["number", "null"], minimum: 10, maximum: 500 },
      limite_gateways: { type: ["integer", "null"], minimum: 1, maximum: 2147483647 },
      relevo: {},
      vegetacoes: {},
      edificacoes: {},
      antenas: {},
    };
    this.app.post("/create-install-criterion", {
      schema: { body: {
        type: "object", required: ["id_usuario", "nome"],
        additionalProperties: false, properties: criterionProperties,
      } },
    }, async (request, reply) => {
      await installCriterionController.CreateInstallCriterion(
        request as Parameters<InstallCriterionController["CreateInstallCriterion"]>[0],
        reply
      );
    });

    this.app.get("/list-install-criteria", {
      schema: { querystring: {
        type: "object", additionalProperties: false,
        properties: {
          id_usuario: criterionId,
          page: { type: "integer", minimum: 1, maximum: 21474836, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        },
      } },
    }, async (request, reply) => {
      return installCriterionController.ListInstallCriteria(
        request as Parameters<InstallCriterionController["ListInstallCriteria"]>[0], reply,
      );
    });

    this.app.get("/get-install-criterion/:id", {
      schema: { params: criterionParams },
    }, async (request, reply) => {
      return installCriterionController.GetInstallCriterion(
        request as Parameters<InstallCriterionController["GetInstallCriterion"]>[0], reply,
      );
    });

    this.app.patch("/update-install-criterion/:id", {
      schema: { params: criterionParams, body: {
        type: "object", minProperties: 1, additionalProperties: false,
        properties: criterionProperties,
      } },
    }, async (request, reply) => {
      return installCriterionController.UpdateInstallCriterion(
        request as Parameters<InstallCriterionController["UpdateInstallCriterion"]>[0], reply,
      );
    });

    this.app.delete("/delete-install-criterion/:id", {
      schema: { params: criterionParams },
    }, async (request, reply) => {
      return installCriterionController.DeleteInstallCriterion(
        request as Parameters<InstallCriterionController["DeleteInstallCriterion"]>[0], reply,
      );
    });

    // PERFIL RF
    this.app.get("/list-rf-profiles", {
      schema: { querystring: {
        type: "object", additionalProperties: false,
        properties: {
          id_usuario: criterionId,
          page: { type: "integer", minimum: 1, maximum: 21474836, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      } },
    }, async (request, reply) => {
      return rfControler.ListRFProfiles(
        request as Parameters<RFController["ListRFProfiles"]>[0],
        reply,
      );
    });

    const rfProfileFields = {
      nome: { type: "string", minLength: 1, maxLength: 150, pattern: "\\S" },
      frequencia_mhz: { type: "number" },
      potencia_transmissao_dbm: { type: "number" },
      sensibilidade_recepcao_dbm: { type: "number" },
      altura_gateway_m: { type: ["number", "null"] },
      altura_dispositivo_m: { type: ["number", "null"] },
      capacidade_max_equipamentos: { type: ["integer", "null"] },
      atenuacao_adicional_db: { type: ["number", "null"] },
      considera_relevo: { type: "boolean" },
      considera_vegetacao: { type: "boolean" },
      considera_edificacoes: { type: "boolean" },
      considera_antenas: { type: "boolean" },
    };
    const rfProfileProperties = { id_usuario: criterionId, ...rfProfileFields };
    this.app.get("/get-rf-profile/:id", {
      schema: { params: criterionParams },
    }, async (request, reply) => {
      return rfControler.GetLocalRFProfile(
        request as Parameters<RFController["GetLocalRFProfile"]>[0],
        reply,
      );
    });

    this.app.post("/create-rf-profile", {
      schema: { body: {
        type: "object",
        required: ["id_usuario", "nome", "frequencia_mhz", "potencia_transmissao_dbm", "sensibilidade_recepcao_dbm"],
        additionalProperties: false,
        properties: rfProfileProperties,
      } },
    }, async (request, reply) => {
      return rfControler.CreateLocalRFProfile(
        request as Parameters<RFController["CreateLocalRFProfile"]>[0],
        reply,
      );
    });

    this.app.patch("/update-rf-profile/:id", {
      schema: {
        params: criterionParams,
        body: {
          type: "object",
          minProperties: 1,
          additionalProperties: false,
          properties: rfProfileFields,
        },
      },
    }, async (request, reply) => {
      return rfControler.UpdateLocalRFProfile(
        request as Parameters<RFController["UpdateLocalRFProfile"]>[0],
        reply,
      );
    });

    this.app.delete("/delete-rf-profile/:id", {
      schema: { params: criterionParams },
    }, async (request, reply) => {
      return rfControler.DeleteLocalRFProfile(
        request as Parameters<RFController["DeleteLocalRFProfile"]>[0],
        reply,
      );
    });

    this.app.post("/create-RF-Profile", async (request, reply) => {
      await rfControler.CreateRFProfile(
        request as Parameters<RFController["CreateRFProfile"]>[0],
        reply
      );
    });

  }
}
