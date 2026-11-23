import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import { PasswordService } from "../src/services/PasswordService.js";
import { authenticate } from "../src/modules/auth.routes.js";
import { UserService } from "../src/services/UserService.js";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

const secret = "test-only-secret-with-at-least-thirty-two-bytes";
const jti = "c64f8bbf-7aa0-4a54-9d15-b8e45ce72c4c";
const input = { username: "Rafael Coelho", email: "rafael@example.com", senha: "Uma senha longa!" };
const user = { id_usuario: "42", username: input.username, email: input.email,
  criado_em: "2026-11-03T12:00:00.000Z", atualizado_em: null };
let passwordHash: string;
let apps: FastifyInstance[] = [];

beforeAll(async () => { passwordHash = await new PasswordService().hash(input.senha); });
beforeEach(() => { vi.restoreAllMocks(); database.query.mockReset(); });
afterEach(async () => { await Promise.all(apps.map((app) => app.close())); apps = []; });
function createApp() {
  const app = new App({ authSecret: secret }).getInstance();
  apps.push(app);
  return app;
}

describe("SCRUM-75 cadastro", () => {
  it.each(["/auth/register", "/usuarios", "/create-user"])("persiste via %s e nunca expõe a senha", async (url) => {
    database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...user, senha_hash: "must-not-leak" }] });
    const app = createApp();
    const response = await app.inject({ method: "POST", url, payload: { ...input, username: " Rafael Coelho ", email: " RAFAEL@EXAMPLE.COM " } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toEqual({ ...user, id_usuario: 42 });
    expect(response.body).not.toContain("senha");
    const values = database.query.mock.calls[1]?.[1];
    expect(values.slice(0, 2)).toEqual([input.username, input.email]);
    expect(values[2]).not.toBe(input.senha);
    expect(await new PasswordService().verify(input.senha, values[2])).toBe(true);
    expect(database.query.mock.calls[1]?.[0]).not.toContain("RETURNING *");
  });

  it.each([
    {}, { username: "abc", email: "x@y.com" }, { ...input, username: "  " },
    { ...input, email: "invalido" }, { ...input, senha: "curta" },
    { ...input, senha: " ".repeat(8) }, { ...input, senha: "a".repeat(129) },
    { ...input, senha: 123456789 }, { ...input, username: ["teste"] },
    { ...input, senha_hash: "injetado" }, { ...input, id_usuario: 2 },
  ])("rejeita dados inválidos sem consultar banco: %j", async (payload) => {
    const response = await createApp().inject({ method: "POST", url: "/auth/register", payload });
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it.each([
    [{ username: "outro", email: "RAFAEL@example.com" }, "EMAIL_ALREADY_EXISTS"],
    [{ username: "RAFAEL COELHO", email: "outro@example.com" }, "USERNAME_ALREADY_EXISTS"],
  ])("rejeita duplicatas já existentes", async (duplicate, code) => {
    database.query.mockResolvedValueOnce({ rows: [duplicate] });
    const response = await createApp().inject({ method: "POST", url: "/auth/register", payload: input });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(code);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it.each(["usuarios_email_normalizado_key", "usuarios_username_normalizado_key"])("trata concorrência protegida pelo índice %s", async (constraint) => {
    database.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce({ code: "23505", constraint });
    const response = await createApp().inject({ method: "POST", url: "/auth/register", payload: input });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(constraint.includes("email") ? "EMAIL_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS");
  });

  it("oculta detalhes internos de erros de banco", async () => {
    database.query.mockRejectedValueOnce(new Error("database-password-must-not-leak"));
    const response = await createApp().inject({ method: "POST", url: "/auth/register", payload: input });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database-password");
  });

  it("compartilha o limite de cadastro entre os aliases", async () => {
    vi.spyOn(UserService.prototype, "createUser").mockResolvedValue({ ...user, id_usuario: 42 });
    const app = createApp();
    const urls = ["/auth/register", "/usuarios", "/create-user"];
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await app.inject({ method: "POST", url: urls[attempt % 3]!, payload: input });
      expect(response.statusCode).toBe(201);
    }
    const blocked = await app.inject({ method: "POST", url: "/create-user", payload: input });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().code).toBe("TOO_MANY_REQUESTS");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});

describe("SCRUM-76 autenticação", () => {
  it("autentica com o hash real e usa somente a identidade do JWT em /auth/me", async () => {
    database.query.mockResolvedValueOnce({ rows: [{ ...user, senha_hash: passwordHash }] })
      .mockResolvedValueOnce({ rows: [] });
    const app = createApp();
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: " RAFAEL@example.com ", senha: input.senha } });
    expect(login.statusCode).toBe(200);
    const data = login.json();
    expect(data.usuario.id_usuario).toBe(42);
    expect(data.expires_in).toBe(3600);
    expect(data.token_type).toBe("Bearer");
    expect(login.headers["cache-control"]).toBe("no-store");
    expect(login.body).not.toContain("senha");
    const decoded = await app.jwt.verify<{ sub: string; exp: number; iat: number }>(data.access_token);
    expect(decoded.sub).toBe("42");
    expect(decoded.exp - decoded.iat).toBe(3600);
    database.query.mockResolvedValueOnce({ rows: [{ active: true }] }).mockResolvedValueOnce({ rows: [user] });
    const me = await app.inject({ url: "/auth/me", headers: { authorization: `Bearer ${data.access_token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().usuario.id_usuario).toBe(42);
    expect(database.query.mock.calls[3]?.[1]).toEqual(["42"]);
  });

  it.each(["missing", "wrong-password", "legacy-plaintext"])("retorna erro genérico para %s", async (reason) => {
    database.query.mockResolvedValueOnce({ rows: reason === "missing" ? [] : [{ ...user, senha_hash: reason === "legacy-plaintext" ? input.senha : passwordHash }] });
    const response = await createApp().inject({ method: "POST", url: "/auth/login", payload: { email: input.email, senha: reason === "wrong-password" ? "errada" : input.senha } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." });
    expect(response.body).not.toContain("access_token");
  });

  it("rejeita tokens ausentes, inválidos, expirados, assinatura diferente e audiência diferente", async () => {
    const app = createApp();
    await app.ready();
    for (const token of [undefined, "invalido", await app.jwt.sign({ sub: "42", jti }, { expiresIn: -1 }),
      await app.jwt.sign({ sub: "42", jti }, { aud: "outro" }), await app.jwt.sign({ sub: "0", jti }),
      `${(await app.jwt.sign({ sub: "42", jti })).split(".").slice(0, 2).join(".")}.invalidsignature`]) {
      const response = await app.inject({ url: "/auth/me", headers: token ? { authorization: `Bearer ${token}` } : {} });
      expect(response.statusCode).toBe(401);
    }
    expect(database.query).not.toHaveBeenCalled();
  });

  it("rejeita sessão de usuário que deixou de existir", async () => {
    const app = createApp();
    await app.ready();
    database.query.mockResolvedValueOnce({ rows: [] });
    const response = await app.inject({ url: "/auth/me", headers: { authorization: `Bearer ${await app.jwt.sign({ sub: "42", jti })}` } });
    expect(response.statusCode).toBe(401);
  });

  it("o guard é reutilizável fora do módulo auth", async () => {
    const app = createApp();
    app.get("/protected-test", { preHandler: authenticate }, (request) => ({ id: request.user.sub }));
    await app.ready();
    expect((await app.inject({ url: "/protected-test" })).statusCode).toBe(401);
    database.query.mockResolvedValueOnce({ rows: [{ active: true }] });
    const response = await app.inject({ url: "/protected-test", headers: { authorization: `Bearer ${await app.jwt.sign({ sub: "42", jti })}` } });
    expect(response.json()).toEqual({ id: "42" });
  });

  it("limita tentativas de login por IP", async () => {
    vi.spyOn(PasswordService.prototype, "verify").mockResolvedValue(false);
    database.query.mockResolvedValue({ rows: [] });
    const app = createApp();
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: input.email, senha: "errada" } })).statusCode).toBe(401);
    }
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: input.email, senha: "errada" } })).statusCode).toBe(429);
    expect(database.query).toHaveBeenCalledTimes(10);
  });

  it("não usa um segredo padrão inseguro quando a configuração está ausente", async () => {
    const app = new App({ authSecret: "short" }).getInstance();
    apps.push(app);
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: input.email, senha: input.senha } });
    expect(response.statusCode).toBe(503);
    expect(database.query).not.toHaveBeenCalled();
  });
});
