import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("rotas CRUD", () => {
    it("aceita a listagem sem corpo", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "GET",
            url: "/estudos"
        });

        expect(response.statusCode).not.toBe(400);
        await app.close();
    });

    it("rejeita ID inválido antes de consultar o banco", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "GET",
            url: "/estudos/zero"
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });

    it("rejeita PATCH sem campos para atualizar", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "PATCH",
            url: "/estudos/1",
            payload: {}
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });

});
