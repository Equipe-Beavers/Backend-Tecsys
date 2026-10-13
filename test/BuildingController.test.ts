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

describe("PATCH /update-building-material/:code", () => {
    it("rejeita corpo vazio", async () => {
        const app = createTestApp();
        const response = await app.inject({
            method: "PATCH",
            url: "/update-building-material/CONCRETO",
            payload: {},
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

describe("POST /import-buildings", () => {
    it("exige a área completa", async () => {
        const app = createTestApp();
        const response = await app.inject({ method: "POST", url: "/import-buildings", payload: { minLatitude: -23.2 } });
        expect(response.statusCode).toBe(400);
        await app.close();
    });
});
