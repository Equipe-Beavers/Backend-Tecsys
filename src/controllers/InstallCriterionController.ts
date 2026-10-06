import type { FastifyReply, FastifyRequest } from "fastify";
import { InstallCriterionService } from "../services/InstallCriterionService.js";
import type { CreateInstallCriterionDTO, ListInstallCriteriaDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "../utils/InstallCriterionError.js";

export class InstallCriterionController {
  private installCriterionService: InstallCriterionService;

  constructor() {
    this.installCriterionService = new InstallCriterionService();
  }

  private HandleError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
    if (error instanceof InstallCriterionError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    request.log.error({ err: error }, "Install criterion operation failed");
    return reply.status(500).send({ message: "Não foi possível concluir a operação de critérios de instalação." });
  }

  async CreateInstallCriterion(request: FastifyRequest<{ Body: CreateInstallCriterionDTO }>, reply: FastifyReply) {
    try {
      const data = await this.installCriterionService.createInstallCriterion(request.body);
      return reply.status(201).send({ message: "Critério de instalação criado com sucesso!", data });
    } catch (error) {
      return this.HandleError(error, request, reply);
    }
  }

  async ListInstallCriteria(request: FastifyRequest<{ Querystring: ListInstallCriteriaDTO }>, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.installCriterionService.listInstallCriteria(request.query));
    } catch (error) {
      return this.HandleError(error, request, reply);
    }
  }

  async GetInstallCriterion(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const data = await this.installCriterionService.getInstallCriterion(request.params.id);
      return reply.status(200).send({ data });
    } catch (error) {
      return this.HandleError(error, request, reply);
    }
  }

  async UpdateInstallCriterion(request: FastifyRequest<{ Params: { id: number }; Body: Partial<CreateInstallCriterionDTO> }>, reply: FastifyReply) {
    try {
      const data = await this.installCriterionService.updateInstallCriterion(request.params.id, request.body);
      return reply.status(200).send({ message: "Critério de instalação atualizado com sucesso!", data });
    } catch (error) {
      return this.HandleError(error, request, reply);
    }
  }

  async DeleteInstallCriterion(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await this.installCriterionService.deleteInstallCriterion(request.params.id);
      return reply.status(204).send();
    } catch (error) {
      return this.HandleError(error, request, reply);
    }
  }
}
