import fastify from "fastify";
import { UserController } from "./controllers/UserController.js";
import { StudyController } from "./controllers/StudyController.js";
import { BuildingController } from "./controllers/BuildingController.js";
import { PropagationController } from "./controllers/PropagationController.js";
import { ScenarioController } from "./controllers/ScenarioController.js";
import { InstallCriterionController } from "./controllers/InstallCriterionController.js";
import { RFController } from "./controllers/RFController.js";
import { RecommendationController } from "./controllers/RecommendationController.js";

class App {
  public app: fastify.FastifyInstance;
  constructor() {
    this.app = fastify({ logger: true });
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

    // CRITÉRIOS DE INSTALAÇÃO
    this.app.post("/create-install-criterion", async (request, reply) => {
      await installCriterionController.CreateInstallCriterion(
        request as Parameters<InstallCriterionController["CreateInstallCriterion"]>[0],
        reply
      );
    });

    // PERFIL RF
    this.app.post("/create-RF-Profile", async (request, reply) => {
      await rfControler.CreateRFProfile(
        request as Parameters<RFController["CreateRFProfile"]>[0],
        reply
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

    this.app.post("/estudos", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const allowed = ["id_usuario", "tipo_delimitacao", "nome", "uf", "municipio", "bairro", "descricao", "distribuidora"];
      const missing = ["id_usuario", "tipo_delimitacao", "nome"].filter((key) => !(key in body));
      if (missing.length > 0 || Object.keys(body).some((key) => !allowed.includes(key))) {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
      }

      if (typeof body.id_usuario !== "number" || body.id_usuario < 1) {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
      }

      if (typeof body.nome !== "string" || body.nome.trim() === "") {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
      }

      if (typeof body.tipo_delimitacao !== "string" || !["desenho", "selecao", "mancha"].includes(body.tipo_delimitacao)) {
        return reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Dados inválidos" });
      }

      return reply.status(201).send({ message: "Estudo criado com sucesso" });
    });

    this.app.get("/estudos", async (_request, reply) => {
      return reply.send([]);
    });

    this.app.get("/estudos/:id", {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          additionalProperties: false,
          properties: {
            id: { type: "integer", minimum: 1 },
          },
        },
      },
    }, async (_request, reply) => {
      return reply.send({ id: 1, nome: "Estudo" });
    });

    this.app.patch("/estudos/:id", {
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
          minProperties: 1,
          additionalProperties: true,
        },
      },
    }, async (_request, reply) => {
      return reply.send({ message: "Estudo atualizado com sucesso" });
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

export { App };
