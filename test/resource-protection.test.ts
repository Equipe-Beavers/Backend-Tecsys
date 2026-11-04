import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import { protectedResourceRoutes } from "../src/modules/resource-protection.js";
import { randomUUID } from "node:crypto";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));
const secret = "resource-test-secret-at-least-thirty-two-bytes";
let app: ReturnType<App["getInstance"]>;
beforeEach(() => { database.query.mockReset(); app = new App({ authSecret: secret }).getInstance(); app.log.level = "silent"; });
afterEach(async () => { await app.close(); });

describe("proteção das rotas persistentes", () => {
  it("exige autenticação em todos os métodos e aliases registrados", async () => {
    await app.ready();
    let checked = 0;
    for (const url of protectedResourceRoutes) {
      for (const method of ["GET", "POST", "PATCH", "DELETE", "HEAD"] as const) {
        if (!app.hasRoute({ method, url })) continue;
        const response = await app.inject({ method, url: url.replace(":id", "999") });
        expect(response.statusCode, `${method} ${url}`).toBe(401);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
    expect(database.query).not.toHaveBeenCalled();
  });

  it("bloqueia recursos quando a consulta da sessão falha", async () => {
    await app.ready();
    database.query.mockRejectedValueOnce(new Error("db unavailable"));
    const token = await app.jwt.sign({ sub: "1", jti: randomUUID() });
    const response = await app.inject({ url: "/estudos", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(503);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("logout revoga no banco e o mesmo token não acessa mais recursos", async () => {
    await app.ready();
    const jti = randomUUID();
    const headers = { authorization: `Bearer ${await app.jwt.sign({ sub: "1", jti })}` };
    database.query.mockResolvedValueOnce({ rows: [{ active: true }] }).mockResolvedValueOnce({ rows: [] });
    expect((await app.inject({ method: "POST", url: "/auth/logout", headers })).statusCode).toBe(204);
    expect(database.query.mock.calls[1]?.[0]).toContain("UPDATE sessoes_usuario");
    expect(database.query.mock.calls[1]?.[1]).toEqual([jti, "1"]);
    database.query.mockResolvedValue({ rows: [] });
    expect((await app.inject({ url: "/estudos", headers })).statusCode).toBe(401);
    expect((await app.inject({ url: "/auth/me", headers })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/logout", headers })).statusCode).toBe(401);
  });
});
