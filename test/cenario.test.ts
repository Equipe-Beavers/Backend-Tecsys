import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /cenarios", () => {
    it("rejeita dependências e dados obrigatórios ausentes", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenarios",
            payload: { nome: "Cenário de teste" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita percentual de cobertura acima de 100", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/cenarios",
            payload: {
                id_estudo: 1,
                id_perfil_rf: 1,
                nome: "Cenário de teste",
                status: "RASCUNHO",
                percentual_cobertura: 101
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});