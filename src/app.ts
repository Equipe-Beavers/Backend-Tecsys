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
    this.app.post("/create-study", async (request, reply) => {
      await studyController.CreateStudy(
        request as Parameters<StudyController["CreateStudy"]>[0],
        reply,
      );
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
      distancia_maxima_ativos_m: { type: ["number", "null"], minimum: 0, maximum: 9999999999.99 },
      locais_autorizados: {},
      locais_obrigatorios: {},
      locais_proibidos: {},
      limite_gateways: { type: ["integer", "null"], minimum: 1, maximum: 2147483647 },
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
    this.app.post("/create-RF-Profile", async (request, reply) => {
      await rfControler.CreateRFProfile(
        request as Parameters<RFController["CreateRFProfile"]>[0],
        reply
      );
    });

  }
}
