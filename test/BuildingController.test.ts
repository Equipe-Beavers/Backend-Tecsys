import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

const point = { latitude: -23.2, longitude: -45.9, height_m: 10 };

describe("GET /list-buildings", () => {
    it("exige o bounding box completo", async () => {
        const app = createTestApp();
        const response = await app.inject({ method: "GET", url: "/list-buildings?minLatitude=-23.2" });
        expect(response.statusCode).toBe(400);
        await app.close();
    });

    it("rejeita bounding box invertido", async () => {
        const app = createTestApp();
        const response = await app.inject({
            method: "GET",
            url: "/list-buildings?minLatitude=-23.1&maxLatitude=-23.2&minLongitude=-45.9&maxLongitude=-45.8",
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Bounding box inválido.");
        await app.close();
    });

    it("rejeita bounding box maior que o permitido", async () => {
        const app = createTestApp();
        const response = await app.inject({
            method: "GET",
            url: "/list-buildings?minLatitude=-24&maxLatitude=-23&minLongitude=-45.9&maxLongitude=-45.8",
        });
        expect(response.statusCode).toBe(400);
        await app.close();
    });
});

describe("GET /list-building-materials", () => {
    it("lista os materiais com cimento como padrão", async () => {
        const app = createTestApp();
        const response = await app.inject({ method: "GET", url: "/list-building-materials" });
        expect(response.statusCode).toBe(200);
        const padrao = response.json().data.filter((m: { padrao: boolean }) => m.padrao);
        expect(padrao).toHaveLength(1);
        expect(padrao[0].codigo).toBe("CIMENTO");
        await app.close();
    });
});

describe("POST /calculate-building-obstruction", () => {
    it("exige a frequência", async () => {
        const app = createTestApp();
        const response = await app.inject({
            method: "POST",
            url: "/calculate-building-obstruction",
            payload: { links: [{ id: "a", origin: point, destination: point }] },
        });
        expect(response.statusCode).toBe(400);
        await app.close();
    });

    it("rejeita ids de enlace repetidos", async () => {
        const app = createTestApp();
        const response = await app.inject({
            method: "POST",
            url: "/calculate-building-obstruction",
            payload: {
                frequency_mhz: 915,
                links: [
                    { id: "a", origin: point, destination: point },
                    { id: "a", origin: point, destination: point },
                ],
            },
        });
        expect(response.statusCode).toBe(400);
        await app.close();
    });
});

describe("GET /get-scenario-coverage/:id", () => {
    it("rejeita id inválido", async () => {
        const app = createTestApp();
        const response = await app.inject({ method: "GET", url: "/get-scenario-coverage/abc" });
        expect(response.statusCode).toBe(400);
        await app.close();
    });
});

describe("rotas que gravavam edificações no banco", () => {
    it("não existem mais", async () => {
        const app = createTestApp();
        for (const [method, url] of [["POST", "/import-buildings"], ["PATCH", "/update-building/1"], ["PATCH", "/update-building-material/CIMENTO"]] as const) {
            const response = await app.inject({ method, url, payload: {} });
            expect(response.statusCode).toBe(404);
        }
        await app.close();
    });
});
