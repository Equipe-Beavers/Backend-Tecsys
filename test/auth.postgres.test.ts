import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const socket = process.env.AUTH_POSTGRES_TEST_SOCKET;
// This suite can only connect to a disposable cluster in /tmp, never to .env/AWS.
const isolated = !!socket && /^\/tmp\/geomash-auth-pg\.[A-Za-z0-9]+$/.test(socket);

describe.skipIf(!isolated)("autenticação com PostgreSQL temporário real", () => {
  let app: FastifyInstance;
  let database: Pool;
  let token: string;
  const user = { username: "Teste PostgreSQL", email: "postgres@example.com", senha: "Senha de integração!" };

  beforeAll(async () => {
    process.env.DB_HOST = socket;
    process.env.DB_PORT = "55475";
    process.env.DB_NAME = "postgres";
    process.env.DB_USER = "auth_test";
    process.env.DB_PASSWORD = "isolated-test";
    process.env.DB_SSL = "false";
    process.env.DB_SSL_MODE = "disable";
    process.env.DISABLE_SUPABASE = "true";
    database = (await import("../src/database/pool.js")).pool;
    await database.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
    await database.query(schema);
    const migration = readFileSync(new URL("../database/migrations/20261103_auth_user_uniqueness.sql", import.meta.url), "utf8");
    await database.query(migration);
    await database.query(migration); // Reapplying must be safe.
    await database.query(readFileSync(new URL("../database/migrations/20261103_auth_sessions.sql", import.meta.url), "utf8"));
    const { App } = await import("../src/app.js");
    app = new App({ authSecret: "isolated-postgres-secret-with-thirty-two-bytes" }).getInstance();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await database?.end();
  });

  it("cadastra, persiste hash, autentica e consulta a identidade", async () => {
    const signup = await app.inject({ method: "POST", url: "/auth/register", payload: user });
    expect(signup.statusCode).toBe(201);
    expect(signup.body).not.toContain("senha");
    const saved = await database.query("SELECT senha_hash FROM usuarios WHERE email = $1", [user.email]);
    expect(saved.rows[0].senha_hash).toMatch(/^scrypt\$v1\$/);
    expect(saved.rows[0].senha_hash).not.toBe(user.senha);
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, senha: user.senha } });
    expect(login.statusCode).toBe(200);
    token = login.json().access_token;
    const me = await app.inject({ url: "/auth/me", headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().usuario.email).toBe(user.email);
  });

  it("bloqueia duplicatas normalizadas na API e diretamente no índice", async () => {
    const duplicate = await app.inject({ method: "POST", url: "/auth/register", payload: { ...user, username: "Outro nome", email: user.email.toUpperCase() } });
    expect(duplicate.statusCode).toBe(409);
    await expect(database.query(
      "INSERT INTO usuarios (username, email, senha_hash) VALUES ($1, $2, 'invalid-test-hash')",
      ["Outro nome", ` ${user.email.toUpperCase()} `],
    )).rejects.toMatchObject({ code: "23505", constraint: "usuarios_email_normalizado_key" });
  });

  it("valida campos obrigatórios, e-mail, senha, duplicidade de username e credenciais incorretas", async () => {
    const invalid = [
      { ...user, email: "email-invalido" },
      { username: "Sem email", senha: user.senha },
      { ...user, senha: "curta" },
      { ...user, username: "   " },
    ];
    for (const payload of invalid) {
      const response = await app.inject({ method: "POST", url: "/auth/register", remoteAddress: "198.51.100.10", payload });
      expect(response.statusCode, response.body).toBe(400);
    }
    const duplicate = await app.inject({ method: "POST", url: "/auth/register", remoteAddress: "198.51.100.10", payload: { ...user, email: "outro@example.com", username: user.username.toUpperCase() } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe("USERNAME_ALREADY_EXISTS");
    for (const email of [user.email, "inexistente@example.com"]) {
      const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, senha: "Senha incorreta!" } });
      expect(login.statusCode).toBe(401);
      expect(login.json().code).toBe("INVALID_CREDENTIALS");
    }
    expect((await database.query("SELECT count(*)::int AS total FROM usuarios")).rows[0].total).toBe(1);
  });

  it("bloqueia acesso sem token e com token adulterado no banco real", async () => {
    for (const url of ["/auth/me", "/estudos", "/study", "/list-rf-profiles", "/list-install-criteria"]) {
      expect((await app.inject({ url })).statusCode).toBe(401);
      const response = await app.inject({ url, headers: { authorization: `Bearer ${token.slice(0, -10)}adulterado` } });
      expect(response.statusCode).toBe(401);
    }
  });

  it("cria perfil, critério e estudo pela API, altera e exclui somente os próprios recursos", async () => {
    const headers = { authorization: `Bearer ${token}` };
    const me = await app.inject({ url: "/auth/me", headers });
    const owner = me.json().usuario.id_usuario;
    const profileResponse = await app.inject({ method: "POST", url: "/create-rf-profile", headers, payload: { nome: "RF revisão US70", frequencia_mhz: 915, potencia_transmissao_dbm: 20, sensibilidade_recepcao_dbm: -120 } });
    expect(profileResponse.statusCode, profileResponse.body).toBe(201);
    const profile = profileResponse.json().data;
    expect(profile.id_usuario).toBe(owner);
    const criterionResponse = await app.inject({ method: "POST", url: "/create-install-criterion", headers, payload: { nome: "Critério revisão US70" } });
    expect(criterionResponse.statusCode, criterionResponse.body).toBe(201);
    const criterion = criterionResponse.json().data;
    expect(criterion.id_usuario).toBe(owner);
    const studyResponse = await app.inject({ method: "POST", url: "/estudos", headers, payload: { nome: "Estudo revisão US70", tipo_delimitacao: "desenho", id_perfil_rf: profile.id_perfil_rf, id_criterio_instalacao: criterion.id_criterio_instalacao } });
    expect(studyResponse.statusCode, studyResponse.body).toBe(201);
    const study = studyResponse.json().estudo;
    expect(study.id_usuario).toBe(owner);
    const resources = [
      { get: `/estudos/${study.id_estudo}`, update: `/estudos/${study.id_estudo}`, remove: `/estudos/${study.id_estudo}` },
      { get: `/get-rf-profile/${profile.id_perfil_rf}`, update: `/update-rf-profile/${profile.id_perfil_rf}`, remove: `/delete-rf-profile/${profile.id_perfil_rf}` },
      { get: `/get-install-criterion/${criterion.id_criterio_instalacao}`, update: `/update-install-criterion/${criterion.id_criterio_instalacao}`, remove: `/delete-install-criterion/${criterion.id_criterio_instalacao}` },
    ];
    for (const resource of resources) {
      expect((await app.inject({ url: resource.get, headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "PATCH", url: resource.update, headers, payload: { nome: "Atualizado pelo proprietário" } })).statusCode).toBe(200);
      expect((await app.inject({ method: "PATCH", url: resource.update, headers, payload: { id_usuario: owner + 1 } })).statusCode).toBe(400);
    }
    // Remove the study first so its foreign keys no longer prevent deleting the library items.
    for (const resource of resources) {
      const removed = await app.inject({ method: "DELETE", url: resource.remove, headers });
      expect(removed.statusCode, removed.body).toBe(204);
      expect((await app.inject({ url: resource.get, headers })).statusCode).toBe(404);
    }
  });

  it("permite somente um cadastro ao concorrer pelo mesmo username", async () => {
    const responses = await Promise.all(["one", "two"].map((suffix) => app.inject({
      method: "POST", url: "/auth/register",
      payload: { ...user, username: suffix === "one" ? "Usuario concorrente" : "USUARIO CONCORRENTE", email: `${suffix}@example.com` },
    })));
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const count = await database.query("SELECT count(*)::int AS total FROM usuarios WHERE lower(username) = lower($1)", ["Usuario concorrente"]);
    expect(count.rows[0].total).toBe(1);
  });

  it("isola estudos, critérios, perfis e vínculos entre dois usuários nas rotas alternativas", async () => {
    const owner = (await app.inject({ url: "/auth/me", headers: { authorization: `Bearer ${token}` } })).json().usuario.id_usuario;
    const other = await app.inject({ method: "POST", url: "/auth/register", remoteAddress: "198.51.100.20", payload: { username: "Usuario B", email: "b@example.com", senha: user.senha } });
    expect(other.statusCode, other.body).toBe(201);
    const otherId = Number(other.json().data.id_usuario);
    const fixtures = [];
    for (const id of [owner, otherId]) {
      const profile = (await database.query("INSERT INTO perfis_rf(id_usuario,nome,frequencia_mhz,potencia_transmissao_dbm,sensibilidade_recepcao_dbm) VALUES ($1,'RF',915,20,-120) RETURNING id_perfil_rf", [id])).rows[0].id_perfil_rf;
      const criterion = (await database.query("INSERT INTO criterios_instalacao(id_usuario,nome) VALUES ($1,'Critério') RETURNING id_criterio_instalacao", [id])).rows[0].id_criterio_instalacao;
      const study = (await database.query("INSERT INTO estudos(id_usuario,id_perfil_rf,id_criterio_instalacao,nome,tipo_delimitacao,status) VALUES ($1,$2,$3,'Estudo','desenho','AGUARDANDO_SELECAO') RETURNING id_estudo", [id, profile, criterion])).rows[0].id_estudo;
      const point = (await database.query("INSERT INTO estudo_pontos(id_estudo,origem,papel,latitude,longitude) VALUES ($1,'manual','candidato',-23,-45) RETURNING id_estudo_ponto", [study])).rows[0].id_estudo_ponto;
      const scenario = (await database.query("INSERT INTO cenarios(id_estudo,nome,status) VALUES ($1,'Cenário','teste') RETURNING id_cenario", [study])).rows[0].id_cenario;
      const gateway = (await database.query("INSERT INTO cenario_gateways(id_cenario,id_estudo_ponto) VALUES ($1,$2) RETURNING id_cenario_gateway", [scenario,point])).rows[0].id_cenario_gateway;
      fixtures.push({ profile, criterion, study, point, scenario, gateway });
    }
    const own = fixtures[0]!;
    const foreign = fixtures[1]!;
    const headers = { authorization: `Bearer ${token}` };
    for (const url of ["/estudos", "/study", "/list-install-criteria", "/list-rf-profiles"]) {
      const response = await app.inject({ url, headers });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.body).not.toContain(`\"id_usuario\":${otherId}`);
      expect(response.body).toContain(`\"id_usuario\":${owner}`);
      expect((await app.inject({ url: `${url}?id_usuario=${otherId}`, headers })).statusCode).toBe(403);
    }
    const attempts: { method: "GET" | "PATCH" | "DELETE" | "POST"; url: string; payload?: object }[] = [
      { method: "GET", url: `/estudos/${foreign.study}` },
      ...["/estudos", "/study"].flatMap((path) => [
        { method: "PATCH" as const, url: `${path}/${foreign.study}`, payload: { nome: "Invadido" } },
        { method: "DELETE" as const, url: `${path}/${foreign.study}` },
      ]),
      { method: "GET", url: `/get-install-criterion/${foreign.criterion}` },
      { method: "PATCH", url: `/update-install-criterion/${foreign.criterion}`, payload: { nome: "Invadido" } },
      { method: "DELETE", url: `/delete-install-criterion/${foreign.criterion}` },
      { method: "GET", url: `/get-rf-profile/${foreign.profile}` },
      { method: "PATCH", url: `/update-rf-profile/${foreign.profile}`, payload: { nome: "Invadido" } },
      { method: "DELETE", url: `/delete-rf-profile/${foreign.profile}` },
      { method: "GET", url: `/get-scenario-coverage/${foreign.scenario}` },
      { method: "POST", url: `/study/${foreign.study}/recommendation`, payload: { id_perfil_rf: Number(own.profile) } },
      { method: "POST", url: `/study/${foreign.study}/points`, payload: {} },
      { method: "POST", url: "/create-scenario", payload: { id_estudo: foreign.study } },
      { method: "POST", url: "/create-gateway-scenario", payload: { id_cenario: own.scenario, id_estudo_ponto: foreign.point } },
      { method: "POST", url: "/create-gateway-scenario", payload: { id_cenario: foreign.scenario, id_cenario_gateway: own.gateway, id_estudo_ponto: own.point } },
      { method: "POST", url: "/create-service-scenario", payload: { id_cenario_gateway: foreign.gateway, id_estudo_ponto: own.point } },
      { method: "POST", url: "/cenarios", payload: { id_estudo: Number(foreign.study), id_perfil_rf: Number(own.profile), nome: "Invadido", status: "teste" } },
      { method: "POST", url: "/cenario-gateways", payload: { id_cenario: Number(own.scenario), id_estudo_ponto: Number(foreign.point) } },
      { method: "POST", url: "/cenario-atendimentos", payload: { id_cenario_gateway: Number(foreign.gateway), id_estudo_ponto: Number(own.point) } },
      { method: "POST", url: `/estudos/${foreign.study}/pontos`, payload: { id_estudo: Number(foreign.study), origem: "manual", papel: "candidato", latitude: -23, longitude: -45 } },
      { method: "POST", url: "/generate-coverage", payload: { id_perfil_rf: Number(foreign.profile), latitude: -23, longitude: -45 } },
    ];
    for (const attempt of attempts) {
      const response = await app.inject({ ...attempt, headers });
      expect(response.statusCode, `${attempt.method} ${attempt.url}: ${response.body}`).toBe(404);
    }
    for (const path of ["/estudos", "/create-study"]) {
      expect((await app.inject({ method: "POST", url: path, headers, payload: { id_usuario: otherId } })).statusCode).toBe(403);
      const response = await app.inject({ method: "POST", url: path, headers, payload: { id_perfil_rf: Number(foreign.profile), id_criterio_instalacao: Number(own.criterion), nome: "Invadido", tipo_delimitacao: "desenho" } });
      expect(response.statusCode, response.body).toBe(404);
    }
    for (const path of ["/create-install-criterion", "/criterios-instalacao", "/create-rf-profile", "/create-RF-Profile", "/perfis-rf"]) {
      const response = await app.inject({ method: "POST", url: path, headers, payload: { nome: "Proprietário falsificado", id_usuario: otherId } });
      expect(response.statusCode, `${path}: ${response.body}`).toBe(403);
    }
    expect((await database.query("SELECT nome FROM estudos WHERE id_estudo=$1", [foreign.study])).rows[0].nome).toBe("Estudo");
    expect((await app.inject({ url: `/estudos/${own.study}`, headers })).statusCode).toBe(200);
    const created = await app.inject({ method: "POST", url: "/estudos", headers, payload: { id_perfil_rf: Number(own.profile), id_criterio_instalacao: Number(own.criterion), tipo_delimitacao: "desenho", nome: "Derivado do JWT" } });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().estudo.id_usuario).toBe(owner);
    const secondLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "b@example.com", senha: user.senha } });
    expect(secondLogin.statusCode).toBe(200);
    const otherHeaders = { authorization: `Bearer ${secondLogin.json().access_token}` };
    const listed = await app.inject({ url: "/estudos", headers: otherHeaders });
    expect(listed.body).not.toContain("Derivado do JWT");
    expect((await app.inject({ url: `/estudos/${own.study}`, headers: otherHeaders })).statusCode).toBe(404);
    // Even two resources owned by A cannot be linked across different studies.
    const mismatch = await app.inject({ method: "POST", url: "/create-scenario", headers, payload: { id_estudo: created.json().estudo.id_estudo, id_cenario_base: own.scenario } });
    expect(mismatch.statusCode, mismatch.body).toBe(400);
  });

  it("revoga somente a sessão encerrada e persiste a revogação em outra instância", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, senha: user.senha } });
    const secondToken = login.json().access_token;
    const loginB = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "b@example.com", senha: user.senha } });
    expect(loginB.statusCode).toBe(200);
    const tokenB = loginB.json().access_token;
    expect((await app.inject({ method: "POST", url: "/auth/logout", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(204);
    const { App } = await import("../src/app.js");
    const restarted = new App({ authSecret: "isolated-postgres-secret-with-thirty-two-bytes" }).getInstance();
    try {
      for (const url of ["/auth/me", "/estudos", "/study", "/list-rf-profiles"]) {
        expect((await restarted.inject({ url, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
      }
      expect((await restarted.inject({ url: "/auth/me", headers: { authorization: `Bearer ${secondToken}` } })).statusCode).toBe(200);
      const meB = await restarted.inject({ url: "/auth/me", headers: { authorization: `Bearer ${tokenB}` } });
      expect(meB.statusCode).toBe(200);
      expect(meB.json().usuario.email).toBe("b@example.com");
    } finally { await restarted.close(); }
  });
});
