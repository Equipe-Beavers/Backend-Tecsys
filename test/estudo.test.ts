import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /estudos", () => {
    it("rejeita tipo de delimitação fora do domínio", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/estudos",
            payload: {
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
                id_usuario: 1,
                tipo_delimitacao: "desenho",
                nome: "Estudo de teste",
                campo_inexistente: true
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});