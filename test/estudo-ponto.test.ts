import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /estudos/:id/pontos", () => {
    it("rejeita latitude fora dos limites geográficos", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos/1/pontos",
            payload: {
                id_estudo: 1,
                origem: "manual",
                papel: "interesse",
                latitude: 91,
                longitude: 0
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita origem fora do domínio", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos/1/pontos",
            payload: {
                id_estudo: 1,
                origem: "desconhecida",
                papel: "interesse",
                latitude: 0,
                longitude: 0
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });

    it("rejeita estudo diferente entre a URL e o corpo", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos/1/pontos",
            payload: {
                id_estudo: 2,
                origem: "manual",
                papel: "interesse",
                latitude: 0,
                longitude: 0
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().erro).toBe(
            "O estudo da URL deve ser igual ao estudo informado no corpo"
        );
        await app.close();
    });
});