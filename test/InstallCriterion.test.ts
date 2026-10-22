import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";

import {
  createInstallCriterionQuery, listInstallCriteriaQuery, getInstallCriterionQuery,
  updateInstallCriterionQuery, deleteInstallCriterionQuery, listRFProfilesQuery,
  createRFProfileQuery, getRFProfileQuery, updateRFProfileQuery,
  deleteRFProfileQuery,
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
  requer_alimentacao_eletrica: false, distancia_minima_ativos_m: null, distancia_maxima_ativos_m: 100, limite_gateways: 3,
  relevo: null, vegetacoes: null, edificacoes: null, antenas: null,
  criado_em: "2026-10-06T12:00:00.000Z", atualizado_em: null,
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

  it("creates using only the new model, trims the name and preserves JSON, false and valid distances", async () => {
    new DatabaseResult(criterion);
    const response = await app.inject({ method: "POST", url: "/create-install-criterion", payload: {
      id_usuario: 1, nome: "  Postes  ", tipos_elementos_permitidos: ["POSTE"],
      requer_alimentacao_eletrica: false, distancia_minima_ativos_m: null, distancia_maxima_ativos_m: 100, limite_gateways: 3,
      relevo: { altitude_minima_m: 10, declividade_maxima_graus: 20 },
      vegetacoes: { permitidas: ["PASTAGEM"], proibidas: ["MANGUE"] },
      edificacoes: { quantidade_maxima: 3 },
      antenas: { considerar_conflito_frequencia: false },
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toEqual(criterion);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toBe(createInstallCriterionQuery);
    expect(JSON.parse(database.query.mock.calls[0]?.[1][0])).toEqual({
      id_usuario: 1, nome: "Postes", tipos_elementos_permitidos: ["POSTE"],
      requer_alimentacao_eletrica: false, distancia_minima_ativos_m: null, distancia_maxima_ativos_m: 100, limite_gateways: 3,
      relevo: { altitude_minima_m: 10, declividade_maxima_graus: 20 },
      vegetacoes: { permitidas: ["PASTAGEM"], proibidas: ["MANGUE"] },
      edificacoes: { quantidade_maxima: 3 },
      antenas: { considerar_conflito_frequencia: false },
    });
  });

  it.each([
    {}, { id_usuario: 1 }, { id_usuario: 1, nome: "   " },
    { id_usuario: 0, nome: "Postes" }, { id_usuario: 1, nome: "x".repeat(151) },
    { id_usuario: 1, nome: "Postes", distancia_maxima_ativos_m: -1 },
    { id_usuario: 1, nome: "Postes", distancia_minima_ativos_m: -10 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 1.5 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 0 },
    { id_usuario: 1, nome: "Postes", limite_gateways: 2147483648 },
    { id_usuario: 1, nome: "Postes", requer_alimentacao_eletrica: "unknown" },
    { id_usuario: 1, nome: "Postes", descricao: "old field" },
    { id_usuario: 1, nome: "Postes", altura_minima_m: 10 },
    { id_usuario: 1, nome: "Postes", caracteristicas_minimas_local: {} },
    { id_usuario: 1, nome: "Postes", custo_maximo: 100 },
    { id_usuario: 1, nome: "Postes", locais_autorizados: [] },
    { id_usuario: 1, nome: "Postes", locais_obrigatorios: [] },
    { id_usuario: 1, nome: "Postes", locais_proibidos: [] },
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

  it("lists RF profiles with user filtering, pagination and numeric normalization", async () => {
    new DatabaseResult({
      id_perfil_rf: "8", id_usuario: "1", nome: "LoRa urbano",
      frequencia_mhz: "915.000", potencia_transmissao_dbm: "21.000",
      sensibilidade_recepcao_dbm: "-120.000", altura_gateway_m: "6.00",
      altura_dispositivo_m: "5.00", capacidade_max_equipamentos: 40,
      atenuacao_adicional_db: null, considera_relevo: true,
      considera_vegetacao: true, considera_edificacoes: false,
      considera_antenas: true, criado_em: new Date("2026-10-07T10:00:00Z"),
      atualizado_em: null,
    });
    const response = await app.inject("/list-rf-profiles?id_usuario=1&page=2&limit=10");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      page: 2,
      limit: 10,
      data: [{
        id_perfil_rf: 8, id_usuario: 1, frequencia_mhz: 915,
        potencia_transmissao_dbm: 21, sensibilidade_recepcao_dbm: -120,
        altura_gateway_m: 6, capacidade_max_equipamentos: 40,
        criado_em: "2026-10-07T10:00:00.000Z",
      }],
    });
    expect(database.query).toHaveBeenCalledWith(listRFProfilesQuery, [1, 10, 10]);
  });

  it("rejects invalid RF profile pagination before querying", async () => {
    const response = await app.inject("/list-rf-profiles?id_usuario=1&page=0");
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("creates an RF profile using only columns in the local schema", async () => {
    const profile = {
      id_perfil_rf: 12, id_usuario: 1, nome: "GW-9200 LoRaWAN",
      frequencia_mhz: 915, potencia_transmissao_dbm: 8,
      sensibilidade_recepcao_dbm: -120, altura_gateway_m: 6,
      altura_dispositivo_m: 5, capacidade_max_equipamentos: 1200,
      atenuacao_adicional_db: 4.2, considera_relevo: true,
      considera_vegetacao: false, considera_edificacoes: true,
      considera_antenas: true, criado_em: "2026-10-12T10:00:00.000Z",
      atualizado_em: null,
    };
    new DatabaseResult({
      ...profile,
      id_perfil_rf: "12",
      id_usuario: "1",
      frequencia_mhz: "915.000",
      potencia_transmissao_dbm: "8.000",
      sensibilidade_recepcao_dbm: "-120.000",
      altura_gateway_m: "6.00",
      altura_dispositivo_m: "5.00",
      atenuacao_adicional_db: "4.200",
    });
    const response = await app.inject({
      method: "POST",
      url: "/create-rf-profile",
      payload: {
        id_usuario: 1,
        nome: " GW-9200 LoRaWAN ",
        frequencia_mhz: 915,
        potencia_transmissao_dbm: 8,
        sensibilidade_recepcao_dbm: -120,
        altura_gateway_m: 6,
        altura_dispositivo_m: 5,
        capacidade_max_equipamentos: 1200,
        atenuacao_adicional_db: 4.2,
        considera_relevo: true,
        considera_vegetacao: false,
        considera_edificacoes: true,
        considera_antenas: true,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject(profile);
    expect(database.query).toHaveBeenCalledWith(createRFProfileQuery, [JSON.stringify({
      id_usuario: 1,
      nome: "GW-9200 LoRaWAN",
      frequencia_mhz: 915,
      potencia_transmissao_dbm: 8,
      sensibilidade_recepcao_dbm: -120,
      altura_gateway_m: 6,
      altura_dispositivo_m: 5,
      capacidade_max_equipamentos: 1200,
      atenuacao_adicional_db: 4.2,
      considera_relevo: true,
      considera_vegetacao: false,
      considera_edificacoes: true,
      considera_antenas: true,
    })]);
  });

  it("rejects incomplete RF profile data before querying", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/create-rf-profile",
      payload: { id_usuario: 1, nome: "Incompleto" },
    });
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("rejects negative RF installation heights before querying", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/create-rf-profile",
      payload: {
        id_usuario: 1,
        nome: "Altura inválida",
        frequencia_mhz: 915,
        potencia_transmissao_dbm: 8,
        sensibilidade_recepcao_dbm: -120,
        altura_gateway_m: -1,
        altura_dispositivo_m: -1,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("gets an RF profile by ID and normalizes database numeric values", async () => {
    new DatabaseResult({
      id_perfil_rf: "12", id_usuario: "1", nome: "GW-9200 LoRaWAN",
      frequencia_mhz: "915.000", potencia_transmissao_dbm: "8.000",
      sensibilidade_recepcao_dbm: "-120.000", altura_gateway_m: "1.20",
      altura_dispositivo_m: "1.20", capacidade_max_equipamentos: 1200,
      atenuacao_adicional_db: "4.200", considera_relevo: true,
      considera_vegetacao: false, considera_edificacoes: true,
      considera_antenas: true, criado_em: new Date("2026-10-12T10:00:00Z"),
      atualizado_em: null,
    });
    const response = await app.inject("/get-rf-profile/12");
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id_perfil_rf: 12,
      id_usuario: 1,
      frequencia_mhz: 915,
      potencia_transmissao_dbm: 8,
      sensibilidade_recepcao_dbm: -120,
      altura_gateway_m: 1.2,
      atenuacao_adicional_db: 4.2,
      considera_vegetacao: false,
      criado_em: "2026-10-12T10:00:00.000Z",
    });
    expect(database.query).toHaveBeenCalledWith(getRFProfileQuery, [12]);
  });

  it("returns 404 when an RF profile does not exist", async () => {
    new DatabaseResult([]);
    const response = await app.inject("/get-rf-profile/99");
    expect(response.statusCode).toBe(404);
  });

  it("patches supplied RF profile fields without replacing its owner", async () => {
    new DatabaseResult({
      id_perfil_rf: 12, id_usuario: 1, nome: "GW revisado",
      frequencia_mhz: 915, potencia_transmissao_dbm: 8,
      sensibilidade_recepcao_dbm: -120, altura_gateway_m: 1.2,
      altura_dispositivo_m: 1.2, capacidade_max_equipamentos: 1200,
      atenuacao_adicional_db: 4.2, considera_relevo: true,
      considera_vegetacao: true, considera_edificacoes: true,
      considera_antenas: true, criado_em: "2026-10-12T10:00:00.000Z",
      atualizado_em: "2026-10-12T11:00:00.000Z",
    });
    const response = await app.inject({
      method: "PATCH",
      url: "/update-rf-profile/12",
      payload: { nome: " GW revisado ", considera_vegetacao: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.nome).toBe("GW revisado");
    expect(database.query).toHaveBeenCalledWith(
      updateRFProfileQuery,
      [12, JSON.stringify({ nome: "GW revisado", considera_vegetacao: true })],
    );
  });

  it("rejects owner changes and empty RF profile patches", async () => {
    const ownerChange = await app.inject({
      method: "PATCH",
      url: "/update-rf-profile/12",
      payload: { id_usuario: 2 },
    });
    const emptyPatch = await app.inject({
      method: "PATCH",
      url: "/update-rf-profile/12",
      payload: {},
    });
    expect(ownerChange.statusCode).toBe(400);
    expect(emptyPatch.statusCode).toBe(400);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("deletes an RF profile and returns 204", async () => {
    new DatabaseResult({ id_perfil_rf: 8 });
    const response = await app.inject({
      method: "DELETE",
      url: "/delete-rf-profile/8",
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(database.query).toHaveBeenCalledWith(deleteRFProfileQuery, [8]);
  });

  it("returns 404 when deleting a missing RF profile", async () => {
    new DatabaseResult([]);
    const response = await app.inject({
      method: "DELETE",
      url: "/delete-rf-profile/99",
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns 409 when a study references the RF profile", async () => {
    new DatabaseResult(null, { code: "23503" });
    const response = await app.inject({
      method: "DELETE",
      url: "/delete-rf-profile/8",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("vinculado a estudos");
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
    new DatabaseResult({ ...criterion, nome: "Torres", limite_gateways: null, relevo: { altitude_minima_m: 80 } });
    const response = await app.inject({ method: "PATCH", url: "/update-install-criterion/7", payload: { nome: " Torres ", limite_gateways: null, relevo: { altitude_minima_m: 80 } } });
    expect(response.statusCode).toBe(200);
    expect(database.query).toHaveBeenCalledWith(updateInstallCriterionQuery, [7, JSON.stringify({ nome: "Torres", limite_gateways: null, relevo: { altitude_minima_m: 80 } })]);
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
