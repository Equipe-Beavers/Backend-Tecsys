import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("registro das rotas públicas", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = new App().getInstance();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    "/vegetacao/config",
    "/antenas",
    "/emissoes-rf",
    "/distribuidoras",
    "/municipios",
    "/ativos",
  ])("registra GET %s sem o prefixo /api", (url) => {
    expect(app.hasRoute({ method: "GET", url })).toBe(true);
  });

  it.each([
    "/api/vegetacao/config",
    "/api/antenas",
    "/api/emissoes-rf",
    "/api/distribuidoras",
    "/api/ativos",
  ])("não mantém a rota antiga GET %s", (url) => {
    expect(app.hasRoute({ method: "GET", url })).toBe(false);
  });
});
