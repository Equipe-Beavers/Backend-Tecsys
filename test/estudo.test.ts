import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudyQuery, listStudiesQuery, getStudyQuery, updateStudyQuery, deleteStudyQuery } from "../src/database/queries.js";

import { createTestApp } from "./helpers/create-test-app.js";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

beforeEach(() => database.query.mockReset());

const input = {
    id_usuario: 1, id_perfil_rf: 8, id_criterio_instalacao: 7,
    tipo_delimitacao: "desenho", nome: " Estudo local ",
};

describe("POST /estudos", () => {
    it("rejeita tipo de delimitação fora do domínio", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos",
            payload: {
                ...input,
                id_usuario: 1,
                tipo_delimitacao: "invalido",
                nome: "Estudo de teste"
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita propriedades desconhecidas", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos",
            payload: {
                ...input,
                id_usuario: 1,
                tipo_delimitacao: "desenho",
                nome: "Estudo de teste",
                campo_inexistente: true
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });

    it("saves selected profile and criterion IDs through PostgreSQL without Supabase", async () => {
        const study = { ...input, nome: "Estudo local", id_estudo: "12", id_usuario: "1", id_perfil_rf: "8", id_criterio_instalacao: "7" };
        database.query.mockResolvedValueOnce({ rows: [study] });
        const app = createTestApp();
        const response = await app.inject({ method: "POST", url: "/estudos", payload: input });
        expect(response.statusCode).toBe(201);
        expect(response.json().estudo).toMatchObject({ id_estudo: 12, id_usuario: 1, id_perfil_rf: 8, id_criterio_instalacao: 7 });
        expect(database.query.mock.calls[0]?.[0]).toBe(createStudyQuery);
        expect(JSON.parse(database.query.mock.calls[0]?.[1][0])).toMatchObject({ ...input, nome: "Estudo local", geom: null, status: "AGUARDANDO_SELECAO" });
        await app.close();
    });

    it("rejects missing profile or criterion before accessing the database", async () => {
        const app = createTestApp();
        for (const field of ["id_perfil_rf", "id_criterio_instalacao"]) {
            const payload: Record<string, unknown> = { ...input };
            delete payload[field];
            const response = await app.inject({ method: "POST", url: "/estudos", payload });
            expect(response.statusCode).toBe(400);
        }
        expect(database.query).not.toHaveBeenCalled();
        await app.close();
    });

    it("rejects selections that do not belong to the user", async () => {
        database.query.mockResolvedValueOnce({ rows: [] });
        const app = createTestApp();
        const response = await app.inject({ method: "POST", url: "/estudos", payload: input });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toContain("pertencentes ao usuário");
        await app.close();
    });

    it("lists studies with numeric IDs and an optional user filter", async () => {
        database.query.mockResolvedValueOnce({ rows: [{
            ...input, id_estudo: "12", nome_perfil_rf: "Perfil LoRa", nome_criterio_instalacao: "Critério urbano",
        }] });
        const app = createTestApp();
        const response = await app.inject("/estudos?id_usuario=1");
        expect(response.statusCode).toBe(200);
        expect(response.json().estudos[0].id_estudo).toBe(12);
        expect(response.json().estudos[0]).toMatchObject({ nome_perfil_rf: "Perfil LoRa", nome_criterio_instalacao: "Critério urbano" });
        expect(database.query).toHaveBeenCalledWith(listStudiesQuery, [1]);
        await app.close();
    });
});

describe("study editing and deletion", () => {
    it("loads an individual study with numeric IDs", async () => {
        database.query.mockResolvedValueOnce({ rows: [{ ...input, id_estudo: "12" }] });
        const app = createTestApp();
        const response = await app.inject("/estudos/12");
        expect(response.statusCode).toBe(200);
        expect(response.json().estudo.id_estudo).toBe(12);
        expect(database.query).toHaveBeenCalledWith(getStudyQuery, [12]);
        await app.close();
    });

    it("updates only supplied fields and trims text", async () => {
        database.query.mockResolvedValueOnce({ rows: [{ ...input, id_estudo: 12, nome: "Revisado" }] });
        const app = createTestApp();
        const response = await app.inject({ method: "PATCH", url: "/estudos/12", payload: {
            nome: " Revisado ", descricao: " ", id_perfil_rf: 9, id_criterio_instalacao: 10,
        } });
        expect(response.statusCode).toBe(200);
        expect(database.query).toHaveBeenCalledWith(updateStudyQuery, [12, JSON.stringify({
            nome: "Revisado", descricao: null, id_perfil_rf: 9, id_criterio_instalacao: 10,
        })]);
        await app.close();
    });

    it("rejects IDs, empty updates and changes to uneditable fields before querying", async () => {
        const app = createTestApp();
        for (const payload of [{}, { id_usuario: 2 }, { geom: null }, { nome: " " }, { id_perfil_rf: null }]) {
            const response = await app.inject({ method: "PATCH", url: "/estudos/12", payload });
            expect(response.statusCode).toBe(400);
        }
        expect((await app.inject({ method: "DELETE", url: "/estudos/zero" })).statusCode).toBe(400);
        expect(database.query).not.toHaveBeenCalled();
        await app.close();
    });

    it("rejects selections belonging to another user", async () => {
        database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...input, id_estudo: 12 }] });
        const app = createTestApp();
        const response = await app.inject({ method: "PATCH", url: "/estudos/12", payload: { id_perfil_rf: 999 } });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toContain("pertencentes ao usuário");
        await app.close();
    });

    it("returns 404 for missing studies", async () => {
        const app = createTestApp();
        database.query.mockResolvedValue({ rows: [] });
        expect((await app.inject("/estudos/12")).statusCode).toBe(404);
        expect((await app.inject({ method: "PATCH", url: "/estudos/12", payload: { nome: "Teste" } })).statusCode).toBe(404);
        expect((await app.inject({ method: "DELETE", url: "/estudos/12" })).statusCode).toBe(404);
        await app.close();
    });

    it("deletes without a response body", async () => {
        database.query.mockResolvedValueOnce({ rows: [{ id_estudo: 12 }] });
        const app = createTestApp();
        const response = await app.inject({ method: "DELETE", url: "/estudos/12" });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(database.query).toHaveBeenCalledWith(deleteStudyQuery, [12]);
        await app.close();
    });

    it("reports dependencies without deleting related records", async () => {
        database.query.mockRejectedValueOnce({ code: "23503" });
        const app = createTestApp();
        const response = await app.inject({ method: "DELETE", url: "/estudos/12" });
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toContain("vinculado");
        await app.close();
    });
});