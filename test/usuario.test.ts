import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /usuarios", () => {
    it("rejeita campos obrigatórios ausentes", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/usuarios",
            payload: { username: "teste", email: "teste@example.com" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita propriedades desconhecidas", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/usuarios",
            payload: {
                username: "teste",
                email: "teste@example.com",
                senha_hash: "hash",
                senha: "nao-permitida"
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});