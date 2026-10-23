import type { FastifyReply, FastifyRequest } from "fastify";
import { ScenarioService } from "../services/ScenarioService.js";
import type { CriarCenarioAtendimento } from "../interface/cenario-atendimento.js";
import type { CriarCenarioGateway } from "../interface/cenario-gateway.js";
import type { CriarCenario } from "../interface/cenario.js";

export class ScenarioController {
  private ScenarioService: ScenarioService;

  constructor() {
    this.ScenarioService = new ScenarioService();
  }

  async CreateServiceScenario(
    request: FastifyRequest<{ Body: CriarCenarioAtendimento }>,
    reply: FastifyReply,
  ) {
    try {
      const data = await this.ScenarioService.createServiceScenario(
        request.body,
      );
      return reply.status(201).send({
        messsage: "Atendimento do cenário criado com sucesso!",
        data,
      });
    } catch (error: any) {
      return reply.status(400).send({
        message: error.message || "Erro inesperado ao criar atendimento do cenário.",
      });
    }
  }

  async CreateGatewayScenario(
    request: FastifyRequest<{ Body: CriarCenarioGateway }>,
    reply: FastifyReply,
  ) {
    try {
      const data = await this.ScenarioService.createGatewayScenario(
        request.body,
      );
      return reply.status(201).send({
        message: "Gateway do cenário criado com sucesso!",
        data,
      });
    } catch (error: any) {
      return reply.status(400).send({
        message:
          error.message || "Erro inesperado ao criar gateway do cenário.",
      });
    }
  }

  async CreateScneario(
    request: FastifyRequest<{ Body: CriarCenario }>,
    reply: FastifyReply,
  ) {
    try {
        const data = await this.ScenarioService.createScenario(request.body);
        return reply.status(201).send({
            message: "Cenário criado com sucesso!",
            data
        })
    } catch (error: any) {
      return reply.status(400).send({
        message: error.message || "Erro inesperado ao criar cenário",
      });
    }
  }
}
