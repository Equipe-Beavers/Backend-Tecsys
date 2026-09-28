import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /cenario-atendimentos", () => {
    it("rejeita as referências obrigatórias ausentes", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenario-atendimentos",
            payload: {}
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita distância negativa", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenario-atendimentos",
            payload: {
                id_cenario_gateway: 1,
                id_estudo_ponto: 1,
                distancia_m: -1
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});