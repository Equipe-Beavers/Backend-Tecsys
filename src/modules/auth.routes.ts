import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { FastifyJWTOptions } from "@fastify/jwt";
import { randomUUID } from "node:crypto";
import rateLimit from "@fastify/rate-limit";
import { UserController } from "../controllers/UserController.js";
import { UserService } from "../services/UserService.js";
import type { CriarUsuario, LoginUsuario } from "../interface/usuario.js";
import { AuthError } from "../utils/AuthError.js";
import { SessionService } from "../services/SessionService.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; jti: string };
    user: { sub: string; jti: string; iat: number; exp: number };
  }
}

/** Reusable preHandler for endpoints that require an authenticated identity. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header("Cache-Control", "no-store");
  try {
    await request.jwtVerify();
    if (typeof request.user.sub !== "string" || !/^[1-9]\d*$/.test(request.user.sub) || !Number.isSafeInteger(Number(request.user.sub))) {
      throw new Error("Invalid JWT subject");
    }
    if (typeof request.user.jti !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.user.jti)) {
      throw new Error("Invalid JWT identifier");
    }
  } catch {
    reply.header("WWW-Authenticate", "Bearer");
    reply.status(401).send({ code: "INVALID_TOKEN", message: "Autenticação necessária. Entre novamente." });
    return;
  }
  try {
    if (!await new SessionService().isActive(request.user.sub, request.user.jti)) {
      reply.status(401).send({ code: "INVALID_TOKEN", message: "Sessão encerrada ou expirada. Entre novamente." });
    }
  } catch (error) {
    request.log.error({ err: error }, "Falha ao validar sessão");
    reply.status(503).send({ code: "AUTH_UNAVAILABLE", message: "Não foi possível validar a sessão." });
  }
}

const fields = {
  email: { type: "string", format: "email", minLength: 3, maxLength: 254 },
  senha: { type: "string", minLength: 1, maxLength: 128 },
};
const signupSchema = {
  body: {
    type: "object", additionalProperties: false,
    required: ["username", "email", "senha"],
    properties: {
      ...fields,
      username: { type: "string", minLength: 3, maxLength: 100 },
      senha: { type: "string", minLength: 8, maxLength: 128 },
    },
  },
};

export function authSecret(value?: string): string {
    if (!value || Buffer.byteLength(value) < 32 || value.startsWith("<")) {
      throw new AuthError(503, "AUTH_NOT_CONFIGURED", "Autenticação temporariamente indisponível.");
    }
    return value;
}

export function jwtConfiguration(value?: string): FastifyJWTOptions {
  return {
    secret: async () => authSecret(value),
    sign: { algorithm: "HS256", iss: "geomash", aud: "geomash-app", expiresIn: 3600 },
    verify: { algorithms: ["HS256"], allowedIss: "geomash", allowedAud: "geomash-app", requiredClaims: ["sub", "jti", "iat", "exp"] },
  };
}

async function validateRawStrings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body;
  if (body && typeof body === "object" && !Array.isArray(body) &&
      Object.values(body).some((value) => typeof value !== "string")) {
    reply.status(400).send({ code: "FST_ERR_VALIDATION", message: "Os campos de autenticação devem ser textos." });
    return;
  }
  if (body && typeof body === "object" && "email" in body && typeof body.email === "string") {
    body.email = body.email.trim().toLowerCase();
  }
}

export async function authRoutes(app: FastifyInstance, options: { secret?: string }): Promise<void> {
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      error: "Too Many Requests",
      message: "Muitas tentativas. Aguarde antes de tentar novamente.",
    }),
  });
  const controller = new UserController();
  const users = new UserService();
  const signupLimiter = app.rateLimit({ max: 5, timeWindow: "15 minutes" });

  // All registration URLs share one implementation; the old hash-input contract is rejected.
  for (const url of ["/auth/register", "/usuarios", "/create-user"]) {
    app.post<{ Body: CriarUsuario }>(url, { schema: signupSchema, onRequest: signupLimiter, preValidation: validateRawStrings },
      (request, reply) => controller.CreateUser(request, reply));
  }

  app.post<{ Body: LoginUsuario }>("/auth/login", {
    preValidation: validateRawStrings,
    schema: { body: { type: "object", required: ["email", "senha"], additionalProperties: false, properties: fields } },
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      authSecret(options.secret);
      const user = await users.authenticate(request.body);
      const jti = randomUUID();
      const token = await reply.jwtSign({ sub: String(user.id_usuario), jti });
      const payload = app.jwt.decode<{ exp: number }>(token)!;
      await new SessionService().create(String(user.id_usuario), jti, payload.exp);
      return reply.send({ access_token: token, token_type: "Bearer", expires_in: 3600, usuario: user });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      request.log.error({ err: error }, "Falha ao autenticar usuário");
      return reply.status(500).send({ code: "INTERNAL_ERROR", message: "Não foi possível autenticar o usuário." });
    }
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      return reply.send({ usuario: await users.findAuthenticated(request.user.sub) });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      request.log.error({ err: error }, "Falha ao consultar usuário autenticado");
      return reply.status(500).send({ code: "INTERNAL_ERROR", message: "Não foi possível consultar o usuário." });
    }
  });

  app.post("/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      await new SessionService().revoke(request.user.sub, request.user.jti);
      return reply.status(204).send();
    } catch (error) {
      request.log.error({ err: error }, "Falha ao encerrar sessão");
      return reply.status(503).send({ code: "AUTH_UNAVAILABLE", message: "Não foi possível encerrar a sessão." });
    }
  });
}
