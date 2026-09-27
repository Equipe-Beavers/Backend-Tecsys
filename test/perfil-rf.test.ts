import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("POST /perfis-rf", () => {
    it("rejeita parâmetros técnicos obrigatórios ausentes", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/perfis-rf",
            payload: { id_usuario: 1, nome: "Perfil de teste" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("FST_ERR_VALIDATION");
        await app.close();
    });

    it("rejeita JSON inválido nos parâmetros adicionais", async () => {
        const app = createTestApp();

        const response = await app.inject({
            method: "POST",
            url: "/perfis-rf",
            payload: {
                id_usuario: 1,
                nome: "Perfil de teste",
                frequencia_mhz: 915,
                potencia_transmissao_dbm: 20,
                sensibilidade_recepcao_dbm: -120,
                parametros_adicionais: "deve-ser-objeto"
            }
        });

        expect(response.statusCode).toBe(400);
        await app.close();
    });
});