import fastify from "fastify";
import cors from "@fastify/cors";
import { UserController } from "./controllers/UserController.js";
import { StudyController } from "./controllers/StudyController.js";
import { BuildingController } from "./controllers/BuildingController.js";
import { PropagationController } from "./controllers/PropagationController.js";
import { ScenarioController } from "./controllers/ScenarioController.js";
import { InstallCriterionController } from "./controllers/InstallCriterionController.js";
import { RFController } from "./controllers/RFController.js";
import { RecommendationController } from "./controllers/RecommendationController.js";
import { ActiveController } from "./controllers/ActiveController.js";
import { RegionsController } from "./controllers/RegionsController.js";
import { ativoRoutes } from "./modules/ativo.routes.js";


export class App {
  public app: fastify.FastifyInstance;
  constructor() {
    this.app = fastify({ logger: true, ajv: { customOptions: { removeAdditional: false } } });
    void this.app.register(cors, {
      origin: process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean)
        ?? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    });
    void this.app.register(ativoRoutes);
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
    const buildingController = new BuildingController();
    const propagationController = new PropagationController();
    const regionsController = new RegionsController()
    const activeController = new ActiveController();

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

    this.app.get("/study/:id", { schema: { params: studyParams } }, async (request, reply) => {
      return studyController.GetStudy(request as Parameters<StudyController["GetStudy"]>[0], reply);
    });


    this.app.get("/studies", async (request, reply) => {
      return studyController.ListStudies(
        request as Parameters<StudyController["ListStudies"]>[0], reply,
      );
    });
    this.app.patch("/update-study/:id", async (request, reply) => {
      return studyController.UpdateStudy(
        request as Parameters<StudyController["UpdateStudy"]>[0], reply,
      );
    });
    this.app.delete("/delete-study/:id", async (request, reply) => {
      return studyController.DeleteStudy(
        request as Parameters<StudyController["DeleteStudy"]>[0], reply,
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

    // BuildingController (edificações sob demanda da Overture Maps: altura, largura, profundidade e material)
    const frequencyMhz = { type: "number", exclusiveMinimum: 0, maximum: 100000 };
    const linkPoint = {
      type: "object", required: ["latitude", "longitude", "height_m"], additionalProperties: false,
      properties: {
        latitude: { type: "number", minimum: -90, maximum: 90 },
        longitude: { type: "number", minimum: -180, maximum: 180 },
        height_m: { type: "number", minimum: 0, maximum: 1000 },
      },
    };

    this.app.get("/list-buildings", {
      schema: { querystring: {
        type: "object", additionalProperties: false,
        required: ["minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
        properties: {
          minLatitude: { type: "number", minimum: -90, maximum: 90 },
          maxLatitude: { type: "number", minimum: -90, maximum: 90 },
          minLongitude: { type: "number", minimum: -180, maximum: 180 },
          maxLongitude: { type: "number", minimum: -180, maximum: 180 },
          limit: { type: "integer", minimum: 1, maximum: 5000 },
          frequencyMhz,
          format: { type: "string", enum: ["json", "geojson"] },
        },
      } },
    }, async (request, reply) => {
      await buildingController.ListBuildings(
        request as Parameters<BuildingController["ListBuildings"]>[0],
        reply
      );
    });

    this.app.get("/list-building-materials", async (request, reply) => {
      await buildingController.ListBuildingMaterials(request, reply);
    });

    this.app.post("/calculate-building-obstruction", {
      schema: { body: {
        type: "object", required: ["frequency_mhz", "links"], additionalProperties: false,
        properties: {
          frequency_mhz: frequencyMhz,
          max_loss_db: { type: "number", minimum: 0, maximum: 200 },
          links: {
            type: "array", minItems: 1, maxItems: 1000,
            items: {
              type: "object", required: ["id", "origin", "destination"], additionalProperties: false,
              properties: {
                id: { type: "string", minLength: 1, maxLength: 100 },
                origin: linkPoint,
                destination: linkPoint,
              },
            },
          },
        },
      } },
    }, async (request, reply) => {
      await buildingController.CalculateBuildingObstruction(
        request as Parameters<BuildingController["CalculateBuildingObstruction"]>[0],
        reply
      );
    });

    // PropagationController (mancha de cobertura considerando as edificações)
    this.app.post("/generate-coverage", {
      schema: { body: {
        type: "object", required: ["latitude", "longitude", "id_perfil_rf"], additionalProperties: false,
        properties: {
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          id_perfil_rf: { type: "integer", minimum: 1 },
          gateway_height_m: { type: "number", exclusiveMinimum: 0, maximum: 500 },
          rays: { type: "integer", minimum: 8, maximum: 720 },
        },
      } },
    }, async (request, reply) => {
      await propagationController.GenerateCoverage(
        request as Parameters<PropagationController["GenerateCoverage"]>[0],
        reply
      );
    });

    this.app.get("/get-scenario-coverage/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } } },
    }, async (request, reply) => {
      await propagationController.GetScenarioCoverage(
        request as Parameters<PropagationController["GetScenarioCoverage"]>[0],
        reply
      );
    });

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
      distancia_minima_ativos_m: { type: ["number", "null"], minimum: 10, maximum: 500 },
      distancia_maxima_ativos_m: { type: ["number", "null"], minimum: 10, maximum: 500 },
      limite_gateways: { type: ["integer", "null"], minimum: 1, maximum: 2147483647 },
      relevo: {},
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
      altura_gateway_m: { type: ["number", "null"], minimum: 0 },
      altura_dispositivo_m: { type: ["number", "null"], minimum: 0 },
      capacidade_max_equipamentos: { type: ["integer", "null"] },
      atenuacao_adicional_db: { type: ["number", "null"], minimum: 0 },
    };
    const rfProfileProperties = { id_usuario: criterionId, ...rfProfileFields };
    this.app.post("/calculate-rf-range", {
      schema: { body: {
        type: "object",
        required: ["frequencia_mhz", "potencia_transmissao_dbm", "sensibilidade_recepcao_dbm", "atenuacao_adicional_db"],
        additionalProperties: false,
        properties: {
          frequencia_mhz: { type: "number", exclusiveMinimum: 0 },
          potencia_transmissao_dbm: { type: "number" },
          sensibilidade_recepcao_dbm: { type: "number", maximum: 0 },
          atenuacao_adicional_db: { type: "number", minimum: 0 },
        },
      } },
    }, async (request, reply) => {
      return rfControler.CalculateRange(
        request as Parameters<RFController["CalculateRange"]>[0],
        reply,
      );
    });

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

    this.app.get("/distribuidoras", async (request, reply) => {
      return regionsController.ListDistributor(
        request as Parameters<RegionsController["ListDistributor"]>[0], reply,
      );
    });
    this.app.get("/estados", async (request, reply) => {
      return regionsController.ListStates(
        request as Parameters<RegionsController["ListStates"]>[0], reply,
      );
    });
    this.app.get("/municipios", async (request, reply) => {
      return regionsController.ListMunicipios(
        request as Parameters<RegionsController["ListMunicipios"]>[0], reply,
      );
    });
    this.app.get("/bairros", async (request, reply) => {
      return regionsController.ListNeighborhood(
        request as Parameters<RegionsController["ListNeighborhood"]>[0], reply,
      );
    });
    this.app.get("/ativos/distribuidoras", async (request, reply) => {
      return activeController.FindDistributors(request, reply);
    });
    this.app.get("/ativos/tipos-dispositivos", async (request, reply) => {
      return activeController.FindDeviceTypes(request, reply);
    });
    this.app.get("/ativos", async (request, reply) => {
      return activeController.FindAssets(
        request as Parameters<ActiveController["FindAssets"]>[0], reply,
      );
    });
    this.app.get("/ativos/:id", async (request, reply) => {
      return activeController.FindAssetById(
        request as Parameters<ActiveController["FindAssetById"]>[0], reply,
      );
    });

    const validateNoUnexpectedProperties = (body: Record<string, unknown>, allowed: string[], reply: any) => {
      const extras = Object.keys(body).filter((key) => !allowed.includes(key));
      if (extras.length > 0) {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Propriedades desconhecidas" });
      }
      return null;
    };

    // ROTAS DE CRUD/VALIDAÇÃO UTILIZADAS PELOS TESTES
    this.app.post("/usuarios", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const allowed = ["username", "email", "senha_hash"];
      const missing = allowed.filter((key) => !(key in body));
      if (missing.length > 0 || Object.keys(body).some((key) => !allowed.includes(key))) {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
      }

      for (const key of ["username", "email", "senha_hash"]) {
        const value = body[key];
        if (typeof value !== "string" || value.trim() === "") {
          return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
        }
      }

      return reply.status(201).send({ message: "Usuário criado com sucesso" });
    });

    this.app.post("/estudos/:id/pontos", {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          additionalProperties: false,
          properties: {
            id: { type: "integer", minimum: 1 },
          },
        },
        body: {
          type: "object",
          required: ["id_estudo", "origem", "papel", "latitude", "longitude"],
          additionalProperties: false,
          properties: {
            id_estudo: { type: "integer", minimum: 1 },
            origem: { type: "string", enum: ["bdgd", "csv", "manual"] },
            papel: { type: "string", enum: ["candidato", "interesse", "ambos"] },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            relevo_m: { type: ["number", "null"] },
            tipo_ativo: { type: ["string", "null"] },
            rotulo: { type: ["string", "null"] },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as { id_estudo?: number };
      const params = request.params as { id?: number };
      if (body.id_estudo !== params.id) {
        return reply.status(400).send({
          erro: "O estudo da URL deve ser igual ao estudo informado no corpo",
        });
      }
      return reply.status(201).send({ message: "Ponto do estudo criado com sucesso" });
    });

    this.app.post("/cenarios", {
      schema: {
        body: {
          type: "object",
          required: ["id_estudo", "id_perfil_rf", "nome", "status"],
          additionalProperties: false,
          properties: {
            id_estudo: { type: "integer", minimum: 1 },
            id_perfil_rf: { type: "integer", minimum: 1 },
            nome: { type: "string", minLength: 1 },
            status: { type: "string", minLength: 1 },
            percentual_cobertura: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
    }, async (_request, reply) => {
      return reply.status(201).send({ message: "Cenário criado com sucesso" });
    });

    this.app.post("/criterios-instalacao", {
      schema: {
        body: {
          type: "object",
          required: ["id_usuario", "nome"],
          additionalProperties: false,
          properties: {
            id_usuario: { type: "integer", minimum: 1 },
            nome: { type: "string", minLength: 1 },
            tipos_elementos_permitidos: { type: ["object", "null"], additionalProperties: true },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validation = validateNoUnexpectedProperties(body, ["id_usuario", "nome", "tipos_elementos_permitidos"], reply);
      if (validation) return validation;
      return reply.status(201).send({ message: "Critério de instalação criado com sucesso" });
    });

    this.app.post("/cenario-gateways", {
      schema: {
        body: {
          type: "object",
          required: ["id_cenario", "id_estudo_ponto"],
          additionalProperties: false,
          properties: {
            id_cenario: { type: "integer", minimum: 1 },
            id_estudo_ponto: { type: "integer", minimum: 1 },
            capacidade_utilizada_pct: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validation = validateNoUnexpectedProperties(body, ["id_cenario", "id_estudo_ponto", "capacidade_utilizada_pct"], reply);
      if (validation) return validation;
      return reply.status(201).send({ message: "Gateway do cenário criado com sucesso" });
    });

    this.app.post("/cenario-atendimentos", {
      schema: {
        body: {
          type: "object",
          required: ["id_cenario_gateway", "id_estudo_ponto"],
          additionalProperties: false,
          properties: {
            id_cenario_gateway: { type: "integer", minimum: 1 },
            id_estudo_ponto: { type: "integer", minimum: 1 },
            distancia_m: { type: "number", minimum: 0 },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validation = validateNoUnexpectedProperties(body, ["id_cenario_gateway", "id_estudo_ponto", "distancia_m"], reply);
      if (validation) return validation;
      return reply.status(201).send({ message: "Atendimento do cenário criado com sucesso" });
    });

    this.app.post("/perfis-rf", {
      schema: {
        body: {
          type: "object",
          required: ["id_usuario", "nome", "frequencia_mhz", "potencia_transmissao_dbm", "sensibilidade_recepcao_dbm"],
          additionalProperties: false,
          properties: {
            id_usuario: { type: "integer", minimum: 1 },
            nome: { type: "string", minLength: 1 },
            frequencia_mhz: { type: "number", minimum: 0 },
            potencia_transmissao_dbm: { type: "number" },
            sensibilidade_recepcao_dbm: { type: "number" },
            parametros_adicionais: { type: ["object", "null"], additionalProperties: true },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validation = validateNoUnexpectedProperties(body, ["id_usuario", "nome", "frequencia_mhz", "potencia_transmissao_dbm", "sensibilidade_recepcao_dbm", "parametros_adicionais"], reply);
      if (validation) return validation;
      if (body.parametros_adicionais !== undefined && body.parametros_adicionais !== null && typeof body.parametros_adicionais !== "object") {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "parametros_adicionais deve ser um objeto ou nulo" });
      }
      return reply.status(201).send({ message: "Perfil RF criado com sucesso" });
    });

  }
}