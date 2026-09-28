import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /criterios-instalacao", () => {
    it("rejeita o nome ausente", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/criterios-instalacao",
            payload: { id_usuario: 1 }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita tipos de elementos que não sejam objeto ou nulo", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/criterios-instalacao",
            payload: {
                id_usuario: 1,
                nome: "Critério de teste",
                tipos_elementos_permitidos: ["poste"]
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});