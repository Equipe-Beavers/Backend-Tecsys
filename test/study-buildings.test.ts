import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

beforeEach(() => database.query.mockReset());

const LAT = -23.2;
const LON = -45.9;
const AREA = { minLatitude: LAT - 0.01, maxLatitude: LAT + 0.01, minLongitude: LON - 0.01, maxLongitude: LON + 0.01 };

function building(id: string, altura_m: number, codigo_material: string, dLon: number) {
    const s = 0.0002;
    const ring = [[LON + dLon, LAT], [LON + dLon + s, LAT], [LON + dLon + s, LAT + s], [LON + dLon, LAT + s], [LON + dLon, LAT]];
    return { id, altura_m, codigo_material, geometria: { type: "Polygon", coordinates: [ring] } };
}

const payload = {
    area: AREA,
    itens: [building("a", 6, "CONCRETO", 0), building("b", 30, "VIDRO", 0.001)],
};

function mockStudy(frequencia: unknown = 915) {
    database.query
        .mockResolvedValueOnce({ rows: [{ id_estudo: 5, id_usuario: 1, id_perfil_rf: 8, id_criterio_instalacao: 7 }] })
        .mockResolvedValueOnce({ rows: [{ frequencia_mhz: frequencia }] });
}

describe("POST /estudos/:id/edificacoes/calculo", () => {
    it("calcula o resumo das edificações enviadas pelo front", async () => {
        mockStudy();
        const app = createTestApp();

        const response = await app.inject({ method: "POST", url: "/estudos/5/edificacoes/calculo", payload });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id_estudo: 5,
            frequencia_mhz: 915,
            total_edificacoes: 2,
            edificacoes_ignoradas: 0,
            altura_m: { minima: 6, media: 18, maxima: 30 },
        });
        expect(body.por_material.map((m: { codigo_material: string }) => m.codigo_material).sort()).toEqual(["CONCRETO", "VIDRO"]);
        expect(database.query).toHaveBeenCalledTimes(2);
        await app.close();
    });

    it("não grava nada: só consultas SELECT", async () => {
        mockStudy();
        const app = createTestApp();

        await app.inject({ method: "POST", url: "/estudos/5/edificacoes/calculo", payload });

        for (const [sql] of database.query.mock.calls) expect(String(sql).trim().toUpperCase().startsWith("SELECT")).toBe(true);
        await app.close();
    });

    it("devolve 404 quando o estudo não existe", async () => {
        database.query.mockResolvedValueOnce({ rows: [] });
        const app = createTestApp();

        const response = await app.inject({ method: "POST", url: "/estudos/999/edificacoes/calculo", payload });

        expect(response.statusCode).toBe(404);
        await app.close();
    });

    it("devolve 400 para edificações malformadas", async () => {
        mockStudy();
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos/5/edificacoes/calculo",
            payload: { itens: "x" },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/area/);
        await app.close();
    });

    it("devolve 400 quando o perfil de RF não tem frequência", async () => {
        mockStudy(null);
        const app = createTestApp();

        const response = await app.inject({ method: "POST", url: "/estudos/5/edificacoes/calculo", payload });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/frequência/);
        await app.close();
    });

    it("rejeita id de estudo inválido", async () => {
        const app = createTestApp();

        const response = await app.inject({ method: "POST", url: "/estudos/abc/edificacoes/calculo", payload });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});
