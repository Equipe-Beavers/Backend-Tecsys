import fastify from "fastify";
import { UserController } from "./controllers/UserController.js";
import { StudyController } from "./controllers/StudyController.js";
import { ScenarioController } from "./controllers/ScenarioController.js";
import { InstallCriterionController } from "./controllers/InstallCriterionController.js";
import { RFController } from "./controllers/RFController.js";
import { RecommendationController } from "./controllers/RecommendationController.js";
import { RegionsController } from "./controllers/RegionsController.js";
import { ActiveController } from "./controllers/ActiveController.js";

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
    const regionsController = new RegionsController();
    const activeController = new ActiveController();

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

    // REGIÕES
    this.app.get("/distribuidoras", async (request, reply) => {
      return regionsController.ListDistributor(
        request as Parameters<RegionsController["ListDistributor"]>[0],
        reply,
      );
    });

    this.app.get("/estados", async (request, reply) => {
      return regionsController.ListStates(
        request as Parameters<RegionsController["ListStates"]>[0],
        reply,
      );
    });

    this.app.get("/municipios", async (request, reply) => {
      return regionsController.ListMunicipios(
        request as Parameters<RegionsController["ListMunicipios"]>[0],
        reply,
      );
    });

    this.app.get("/bairros", async (request, reply) => {
      return regionsController.ListNeighborhood(
        request as Parameters<RegionsController["ListNeighborhood"]>[0],
        reply,
      );
    });

    // ATIVOS
    this.app.get("/ativos/distribuidoras", async (request, reply) => {
      await activeController.FindDistributors(request, reply);
    });

    this.app.get("/ativos/tipos-dispositivos", async (request, reply) => {
      await activeController.FindDeviceTypes(request, reply);
    });

    this.app.get("/ativos", async (request, reply) => {
      await activeController.FindAssets(
        request as Parameters<ActiveController["FindAssets"]>[0], 
        reply
      );
    });

    this.app.get("/ativos/:id", async (request, reply) => {
      await activeController.FindAssetById(
        request as Parameters<ActiveController["FindAssetById"]>[0],
        reply
      );
    });
  }
}

export { App };
