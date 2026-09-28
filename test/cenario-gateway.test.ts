import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /cenario-gateways", () => {
    it("rejeita as referências obrigatórias ausentes", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenario-gateways",
            payload: {}
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita capacidade utilizada acima de 100 por cento", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenario-gateways",
            payload: {
                id_cenario: 1,
                id_estudo_ponto: 1,
                capacidade_utilizada_pct: 101
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});