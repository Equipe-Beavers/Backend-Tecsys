import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "./auth.routes.js";
import { OwnershipService } from "../services/OwnershipService.js";
import { AuthError } from "../utils/AuthError.js";

const createOwned = new Set([
  "/estudos", "/create-study", "/create-install-criterion", "/criterios-instalacao",
  "/create-rf-profile", "/create-RF-Profile", "/perfis-rf",
]);
const listOwned = new Set(["/estudos", "/study", "/list-install-criteria", "/list-rf-profiles"]);
export const protectedResourceRoutes = new Set([
  ...createOwned, ...listOwned,
  "/estudos/:id", "/study/:id", "/study/:id/points", "/estudos/:id/pontos",
  "/study/:id/recommendation", "/get-scenario-coverage/:id", "/generate-coverage",
  "/create-scenario", "/cenarios", "/create-gateway-scenario", "/cenario-gateways",
  "/create-service-scenario", "/cenario-atendimentos", "/get-install-criterion/:id",
  "/update-install-criterion/:id", "/delete-install-criterion/:id",
  "/get-rf-profile/:id", "/update-rf-profile/:id", "/delete-rf-profile/:id",
]);

function rejectImpersonation(value: unknown, userId: number): void {
  if (value === undefined) return;
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new AuthError(400, "INVALID_USER_ID", "Identificador de usuário inválido.");
  }
  if (Number(value) !== userId) throw new AuthError(403, "USER_MISMATCH", "O usuário deve corresponder à sessão autenticada.");
}

/** Installed before registering routes, so aliases receive identical protection. */
export function registerResourceProtection(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    if (!protectedResourceRoutes.has(route.url)) return;
    const previousAuth = route.onRequest ? (Array.isArray(route.onRequest) ? route.onRequest : [route.onRequest]) : [];
    route.onRequest = [authenticate, ...previousAuth];
    const previousValidation = route.preValidation ? (Array.isArray(route.preValidation) ? route.preValidation : [route.preValidation]) : [];
    route.preValidation = [async (request, reply) => {
      try {
        const userId = Number(request.user.sub);
        const body = request.body as Record<string, unknown> | null;
        const query = request.query as Record<string, unknown>;
        if (request.method === "PATCH" && body && Object.hasOwn(body, "id_usuario")) {
          throw new AuthError(400, "IMMUTABLE_OWNER", "O proprietário do recurso não pode ser alterado.");
        }
        if ((request.method === "GET" || request.method === "HEAD") && listOwned.has(route.url)) {
          rejectImpersonation(query.id_usuario, userId);
          query.id_usuario = userId;
        }
        if (request.method === "POST" && createOwned.has(route.url) && body && typeof body === "object" && !Array.isArray(body)) {
          rejectImpersonation(body.id_usuario, userId);
          body.id_usuario = userId;
        }
      } catch (error) {
        const failure = error as AuthError;
        return reply.status(failure.statusCode).send({ code: failure.code, message: failure.message });
      }
    }, ...previousValidation];

    const previousHandlers = route.preHandler ? (Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler]) : [];
    route.preHandler = [async (request, reply) => {
      try { await authorizeReferences(request, route.url); }
      catch (error) {
        if (error instanceof AuthError) return reply.status(error.statusCode).send({ code: error.code, message: error.message });
        request.log.error({ err: error }, "Falha ao verificar propriedade do recurso");
        return reply.status(503).send({ code: "AUTHORIZATION_UNAVAILABLE", message: "Não foi possível verificar o acesso ao recurso." });
      }
    }, ...previousHandlers];
  });
}

async function authorizeReferences(request: FastifyRequest, route: string): Promise<void> {
  const ownership = new OwnershipService();
  const userId = Number(request.user.sub);
  const body = (request.body ?? {}) as Record<string, unknown>;
  const params = request.params as { id?: number };
  if (route === "/study/:id/points" || route === "/estudos/:id/pontos") {
    if (body.id_estudo !== undefined && Number(body.id_estudo) !== Number(params.id)) {
      throw new AuthError(400, "STUDY_MISMATCH", "O estudo da URL deve ser igual ao estudo informado no corpo.");
    }
    await ownership.require("study", params.id, userId);
    body.id_estudo = Number(params.id);
  }
  if (route === "/study/:id/recommendation") {
    await ownership.require("study", params.id, userId);
  }
  if (route === "/get-scenario-coverage/:id") await ownership.require("scenario", params.id, userId);
  if (body.id_perfil_rf != null) await ownership.require("profile", body.id_perfil_rf, userId);
  if (body.id_criterio_instalacao != null) await ownership.require("criterion", body.id_criterio_instalacao, userId);
  if (route === "/create-scenario" || route === "/cenarios") {
    await ownership.require("study", body.id_estudo, userId);
    if (body.id_cenario_base != null) {
      const base = await ownership.require("scenario", body.id_cenario_base, userId);
      if (Number(base.id_estudo) !== Number(body.id_estudo)) {
        throw new AuthError(400, "STUDY_MISMATCH", "O cenário base deve pertencer ao mesmo estudo.");
      }
    }
  }
  if (["/create-gateway-scenario", "/cenario-gateways", "/create-service-scenario", "/cenario-atendimentos"].includes(route)) {
    const parent = ["/create-service-scenario", "/cenario-atendimentos"].includes(route)
      ? await ownership.require("gateway", body.id_cenario_gateway, userId)
      : await ownership.require("scenario", body.id_cenario, userId);
    const point = await ownership.require("point", body.id_estudo_ponto, userId);
    if (Number(parent.id_estudo) !== Number(point.id_estudo)) {
      throw new AuthError(400, "STUDY_MISMATCH", "Os recursos devem pertencer ao mesmo estudo.");
    }
  }
}
