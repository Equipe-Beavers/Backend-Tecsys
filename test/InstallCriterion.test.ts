import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";

import {
  createInstallCriterionQuery, listInstallCriteriaQuery, getInstallCriterionQuery,
  updateInstallCriterionQuery, deleteInstallCriterionQuery,
} from "../src/database/queries.js";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
// Other modules are out of scope and cannot access Supabase during these tests.
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

class DatabaseResult {
  constructor(data: unknown, error: unknown = null) {
    if (error) database.query.mockRejectedValueOnce(error);
    else database.query.mockResolvedValueOnce({ rows: data == null ? [] : Array.isArray(data) ? data : [data] });
  }
}

const criterion = {
  id_criterio_instalacao: 7, id_usuario: 1, nome: "Postes",
  tipos_elementos_permitidos: ["POSTE"], tipos_elementos_proibidos: null,
  requer_alimentacao_eletrica: false, distancia_maxima_ativos_m: 0,
  locais_autorizados: null, locais_obrigatorios: null, locais_proibidos: null,
  limite_gateways: 3, criado_em: "2026-10-06T12:00:00.000Z", atualizado_em: null,
};

describe("InstallCriterionController CRUD", () => {
  let app: ReturnType<App["getInstance"]>;

  beforeEach(() => {
    database.query.mockReset();
    app = new App().getInstance();
    app.log.level = "silent";
  });
  afterEach(async () => { await app.close(); });

  it("allows Flutter Web preflight for PATCH from localhost", async () => {
    const response = await app.inject({
      method: "OPTIONS", url: "/update-install-criterion/7",
      headers: { origin: "http://localhost:51234", "access-control-request-method": "PATCH", "access-control-request-headers": "content-type" },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:51234");
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(database.query).not.toHaveBeenCalled();
  });

  it("creates using only the new model, trims the name and preserves JSON, false and zero", async () => {
    new DatabaseResult(criterion);
    const response = await app.inject({ method: "POST", url: "/create-install-criterion", payload: {
      id_usuario: 1, nome: "  Postes  ", tipos_elementos_permitidos: ["POSTE"],
      requer_alimentacao_eletrica: false, distancia_maxima_ativos_m: 0, limite_gateways: 3,
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toEqual(criterion);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toBe(createInstallCriterionQuery);
    expect(JSON.parse(database.query.mock.calls[0]?.[1][0])).toEqual({
      id_usuario: 1, nome: "Postes", tipos_elementos_permitidos: ["POSTE"],
      requer_alimentacao_eletrica: false, distancia_maxima_ativos_m: 0, limite_gateways: 3,
    });
  });

  it.each([
    {}, { id_usuario: 1 }, { id_usuario: 1, nome: "   " },
    { id_usuario: 0, nome: "Postes" }, { id_usuario: 1, nome: "x".repeat(151) },
    { id_usuario: 1, nome: "Postes", distancia_maxima_ativos_m: -1 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 1.5 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 0 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 2147483648 },
    { id_usuario: 1, nome: "Postes", requer_alimentacao_eletrica: "unknown" },
    { id_usuario: 1, nome: "Postes", descricao: "old field" },
    { id_usuario: 1, nome: "Postes", altura_minima_m: 10 },
    { id_usuario: 1, nome: "Postes", caracteristicas_minimas_local: {} },
    { id_usuario: 1, nome: "Postes", custo_maximo: 100 },
    { id_usuario: 1, nome: "Postes", criado_em: "2020-01-01" },
  ])("rejects invalid or obsolete create payload before accessing the database: %j", async (payload) => {
    const response = await app.inject({ method: "POST", url: "/create-install-criterion", payload });
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent user through the foreign key", async () => {
    new DatabaseResult(null, { code: "23503" });
    const response = await app.inject({ method: "POST", url: "/create-install-criterion", payload: { id_usuario: 99, nome: "Postes" } });
    expect(response.statusCode).toBe(400);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("lists with user filter and deterministic pagination", async () => {
    new DatabaseResult([criterion]);
    const response = await app.inject("/list-install-criteria?id_usuario=1&page=2&limit=10");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [criterion], page: 2, limit: 10 });
    expect(database.query).toHaveBeenCalledWith(listInstallCriteriaQuery, [1, 10, 10]);
  });

  it("returns an empty list with default pagination", async () => {
    new DatabaseResult([]);
    const response = await app.inject("/list-install-criteria");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], page: 1, limit: 50 });
  });

  it.each(["page=0", "limit=101", "id_usuario=invalid", "unexpected=true"])("rejects invalid list query: %s", async (query) => {
    const response = await app.inject(`/list-install-criteria?${query}`);
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("gets a criterion by ID", async () => {
    new DatabaseResult(criterion);
    const response = await app.inject("/get-install-criterion/7");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: criterion });
    expect(database.query).toHaveBeenCalledWith(getInstallCriterionQuery, [7]);
  });

  it("normalizes PostgreSQL BIGINT, NUMERIC and timestamp values for the frontend", async () => {
    new DatabaseResult({ ...criterion, id_criterio_instalacao: "7", id_usuario: "1",
      distancia_maxima_ativos_m: "1234.56", criado_em: new Date("2026-10-07T10:00:00Z") });
    const response = await app.inject("/get-install-criterion/7");
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id_criterio_instalacao: 7, id_usuario: 1, distancia_maxima_ativos_m: 1234.56,
      criado_em: "2026-10-07T10:00:00.000Z", atualizado_em: null,
    });
  });

  it.each(["zero", "0", "-1", "1.5", "9007199254740992"])("rejects invalid ID: %s", async (id) => {
    const response = await app.inject(`/get-install-criterion/${id}`);
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("patches only supplied fields and allows clearing nullable fields", async () => {
    new DatabaseResult({ ...criterion, nome: "Torres", limite_gateways: null });
    const response = await app.inject({ method: "PATCH", url: "/update-install-criterion/7", payload: { nome: " Torres ", limite_gateways: null } });
    expect(response.statusCode).toBe(200);
    expect(database.query).toHaveBeenCalledWith(updateInstallCriterionQuery, [7, JSON.stringify({ nome: "Torres", limite_gateways: null })]);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("rejects a replacement user through the foreign key", async () => {
    new DatabaseResult(null, { code: "23503" });
    const response = await app.inject({ method: "PATCH", url: "/update-install-criterion/7", payload: { id_usuario: 99 } });
    expect(response.statusCode).toBe(400);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { nome: null }, { nome: " " }, { id_usuario: null }, { id_criterio_instalacao: 10 }, { atualizado_em: "2020-01-01" }])("rejects invalid patch: %j", async (payload) => {
    const response = await app.inject({ method: "PATCH", url: "/update-install-criterion/7", payload });
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it.each(["GET", "PATCH", "DELETE"] as const)("returns 404 for missing criterion on %s", async (method) => {
    new DatabaseResult(null);
    const action = { GET: "get", PATCH: "update", DELETE: "delete" }[method];
    const response = await app.inject({ method, url: `/${action}-install-criterion/99`, ...(method === "PATCH" ? { payload: { nome: "Novo" } } : {}) });
    expect(response.statusCode).toBe(404);
  });

  it("deletes and returns 204 without a response body", async () => {
    new DatabaseResult({ id_criterio_instalacao: 7 });
    const response = await app.inject({ method: "DELETE", url: "/delete-install-criterion/7" });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(database.query).toHaveBeenCalledWith(deleteInstallCriterionQuery, [7]);
  });

  it("returns conflict when a study references the criterion", async () => {
    new DatabaseResult(null, { code: "23503", message: "foreign key violation" });
    const response = await app.inject({ method: "DELETE", url: "/delete-install-criterion/7" });
    expect(response.statusCode).toBe(409);
  });

  it("returns 500 without exposing database details", async () => {
    new DatabaseResult(null, { code: "XX000", message: "private database details" });
    const response = await app.inject("/list-install-criteria");
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("private database details");
  });
});
