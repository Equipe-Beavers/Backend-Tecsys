import { readFileSync, writeFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const port = process.env.EXPORT_POSTGRES_TEST_PORT;
const isolated = !!port && /^\d+$/.test(port) && process.env.EXPORT_POSTGRES_TEST_DB === "geomash_export_test";

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const secret = "isolated-export-secret-with-thirty-two-bytes";

describe.skipIf(!isolated)("exportação em PDF com PostgreSQL temporário real", () => {
    let app: FastifyInstance;
    let database: Pool;
    let owner: Record<string, string>;
    let intruder: Record<string, string>;
    let profileId: number;
    let criterionId: number;
    let studyId: number;
    let recommendation: Record<string, any>;

    const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
        app.inject({ method: method as "GET", url, headers, payload: payload as Record<string, unknown> });

    async function account(email: string): Promise<Record<string, string>> {
        const senha = "Senha de integração!";
        const signup = await call("POST", "/auth/register", {}, { username: email.split("@")[0], email, senha });
        expect(signup.statusCode).toBe(201);
        const login = await call("POST", "/auth/login", {}, { email, senha });
        expect(login.statusCode).toBe(200);
        return { authorization: `Bearer ${login.json().access_token}` };
    }

    async function createStudy(headers: Record<string, string>, nome: string): Promise<number> {
        const response = await call("POST", "/estudos", headers, {
            id_perfil_rf: profileId, id_criterio_instalacao: criterionId, tipo_delimitacao: "selecao",
            nome, uf: "MG", municipio: "Uberaba", bairro: "Centro", distribuidora: "CEMIG-D",
        });
        expect(response.statusCode).toBe(201);
        return Number(response.json().estudo.id_estudo);
    }

    async function addPoint(headers: Record<string, string>, id: number, point: Record<string, unknown>) {
        const response = await call("POST", `/estudos/${id}/pontos`, headers, { id_estudo: id, origem: "manual", ...point });
        expect(response.statusCode).toBe(201);
    }

    async function recommend(id: number, nome: string) {
        const response = await call("POST", `/study/${id}/recommendation`, owner, { id_perfil_rf: profileId, nome_cenario: nome });
        expect(response.statusCode).toBe(201);
        return response.json();
    }

    async function ownerId(): Promise<number> {
        return Number((await database.query("SELECT id_usuario FROM usuarios WHERE email = 'dono@example.com'")).rows[0].id_usuario);
    }

    beforeAll(async () => {
        process.env.DB_HOST = "127.0.0.1";
        process.env.DB_PORT = port;
        process.env.DB_NAME = "geomash_export_test";
        process.env.DB_USER = "export_test";
        process.env.DB_PASSWORD = "isolated-test";
        process.env.DB_SSL = "false";
        process.env.DB_SSL_MODE = "disable";
        process.env.DISABLE_SUPABASE = "true";
        database = (await import("../src/database/pool.js")).pool;
        await database.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
        await database.query(readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8"));

        const { BuildingService } = await import("../src/services/BuildingService.js");
        vi.spyOn(BuildingService.prototype, "loadBuildingsAround").mockResolvedValue(null as never);

        const { App } = await import("../src/app.js");
        app = new App({ authSecret: secret }).getInstance();
        await app.ready();

        owner = await account("dono@example.com");
        intruder = await account("outro@example.com");

        const profile = await call("POST", "/create-rf-profile", owner, {
            nome: "LoRa 915", frequencia_mhz: 915, potencia_transmissao_dbm: 14, sensibilidade_recepcao_dbm: -120,
            altura_gateway_m: 15, altura_dispositivo_m: 1.5, capacidade_max_equipamentos: 4, atenuacao_adicional_db: 0,
        });
        expect(profile.statusCode).toBe(201);
        profileId = Number(profile.json().data.id_perfil_rf);
        const criterion = await call("POST", "/create-install-criterion", owner, { nome: "Padrão urbano" });
        expect(criterion.statusCode).toBe(201);
        criterionId = Number(criterion.json().data.id_criterio_instalacao);

        studyId = await createStudy(owner, "Alimentador SUL-14 — Fase 1");
        await addPoint(owner, studyId, { papel: "candidato", latitude: -19.7476, longitude: -47.9318, tipo_ativo: "POSTE", rotulo: "Poste P-01" });
        await addPoint(owner, studyId, { papel: "candidato", latitude: -19.7520, longitude: -47.9270, tipo_ativo: "POSTE", rotulo: "Poste P-02" });
        const interest = [
            [-19.7480, -47.9320, "TRANSFORMADOR"], [-19.7490, -47.9300, "TRANSFORMADOR"],
            [-19.7510, -47.9280, "RELIGADOR"], [-19.7470, -47.9330, "CHAVE_FUSIVEL"],
            [-19.7530, -47.9260, "REGULADOR_TENSAO"],
            [-19.2000, -47.3000, "RELIGADOR"],
        ] as const;
        for (const [index, [latitude, longitude, tipo]] of interest.entries()) {
            await addPoint(owner, studyId, { papel: "interesse", latitude, longitude, tipo_ativo: tipo, rotulo: `Ativo ${index + 1}` });
        }

        recommendation = await recommend(studyId, "Recomendação inicial");
    }, 120_000);

    afterAll(async () => {
        vi.restoreAllMocks();
        await app?.close();
        await database?.end();
    });

    it("gera o PDF do estudo do usuário logado para download", async () => {
        const response = await call("POST", `/estudos/${studyId}/exportar-pdf`, owner, {
            id_cenario: recommendation.id_cenario, imagem_mapa: `data:image/png;base64,${PNG_1X1}`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"])
            .toBe(`attachment; filename="relatorio-estudo-${studyId}-alimentador-sul-14-fase-1.pdf"`);
        expect(response.headers["access-control-expose-headers"]).toBe("Content-Disposition");
        expect(response.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
        if (process.env.EXPORT_TEST_PDF_OUT) writeFileSync(process.env.EXPORT_TEST_PDF_OUT, response.rawPayload);
    });

    it("recupera exatamente os resultados que a API mostrou na tela", async () => {
        const { StudyExportService } = await import("../src/services/StudyExportService.js");
        const { formatAssetType } = await import("../src/utils/StudyExportUtils.js");
        const report = await new StudyExportService().getReport(studyId, await ownerId(), { id_cenario: recommendation.id_cenario });
        const final = report.cenario_selecionado;

        expect(report.estudo).toMatchObject({
            id_estudo: studyId, nome: "Alimentador SUL-14 — Fase 1",
            regiao: "Centro, Uberaba - MG (Distribuidora: CEMIG-D)",
            nome_perfil_rf: "LoRa 915", nome_criterio_instalacao: "Padrão urbano",
        });
        expect(final.id_cenario).toBe(recommendation.id_cenario);
        expect(final.indicadores).toMatchObject({
            quantidade_gateways: recommendation.quantidade_gateways,
            percentual_cobertura: recommendation.percentual_cobertura,
            pontos_interesse: recommendation.pontos_interesse,
            pontos_cobertos: recommendation.pontos_cobertos,
            pontos_nao_cobertos: recommendation.pontos_nao_cobertos,
            custo_total_estimado: recommendation.custo_total_estimado,
        });
        expect(recommendation.pontos_interesse).toBe(6);
        expect(recommendation.pontos_nao_cobertos).toBeGreaterThanOrEqual(1);

        expect(final.gateways.map((g) => g.id_estudo_ponto).sort())
            .toEqual(recommendation.gateways.map((g: any) => g.id_estudo_ponto).sort());
        for (const gateway of recommendation.gateways) {
            const exported = final.gateways.find((g) => g.id_estudo_ponto === gateway.id_estudo_ponto)!;
            expect(exported.quantidade_atendidos).toBe(gateway.quantidade_atendidos);
            expect(exported.capacidade_utilizada_pct).toBe(Math.round((gateway.quantidade_atendidos / 4) * 1000) / 10);
        }
        const covered = recommendation.ativos_mapa.filter((a: any) => a.coberto).map((a: any) => a.id_estudo_ponto).sort();
        const uncovered = recommendation.ativos_mapa.filter((a: any) => !a.coberto).map((a: any) => a.id_estudo_ponto).sort();
        expect(final.ativos_atendidos.map((a) => a.id_estudo_ponto).sort()).toEqual(covered);
        expect(final.ativos_nao_atendidos.map((a) => a.id_estudo_ponto).sort()).toEqual(uncovered);

        for (const category of recommendation.por_categoria) {
            const exported = final.por_categoria.find((c) => c.tipo_ativo === formatAssetType(category.tipo_ativo))!;
            expect(exported).toMatchObject({ total: category.total, nao_atendidos: category.nao_cobertos });
        }
        expect(report.outros_cenarios).toEqual([]);
    });

    it("inclui as alternativas de implantação quando pedido", async () => {
        const second = await recommend(studyId, "Alternativa 2");
        const { StudyExportService } = await import("../src/services/StudyExportService.js");

        const withAlternatives = await new StudyExportService().getReport(studyId, await ownerId(), {
            id_cenario: recommendation.id_cenario, incluir_alternativas: true,
        });
        expect(withAlternatives.cenario_selecionado.id_cenario).toBe(recommendation.id_cenario);
        expect(withAlternatives.outros_cenarios.map((s) => s.id_cenario)).toEqual([second.id_cenario]);

        // sem id_cenario, exibe o cenário otimizado (o primeiro, sem cenário base)
        const latest = await new StudyExportService().getReport(studyId, await ownerId());
        expect(latest.cenario_selecionado.id_cenario).toBe(recommendation.id_cenario);

        const response = await call("POST", `/estudos/${studyId}/exportar-pdf`, owner, {
            id_cenario: recommendation.id_cenario, incluir_alternativas: true,
        });
        expect(response.statusCode).toBe(200);
    });

    it("não deixa exportar sem login nem o estudo de outro usuário", async () => {
        expect((await call("POST", `/estudos/${studyId}/exportar-pdf`, {}, {})).statusCode).toBe(401);
        const foreign = await call("POST", `/estudos/${studyId}/exportar-pdf`, intruder, {});
        expect(foreign.statusCode).toBe(404);
        expect(foreign.rawPayload.subarray(0, 5).toString()).not.toBe("%PDF-");
        const forged = await call("POST", `/estudos/${studyId}/exportar-pdf`, { authorization: `${owner.authorization!.slice(0, -6)}abcdef` }, {});
        expect(forged.statusCode).toBe(401);
    });

    it("recusa cenário de outro estudo e estudo ainda não processado", async () => {
        const otherStudy = await createStudy(owner, "Estudo sem recomendação");
        const notProcessed = await call("POST", `/estudos/${otherStudy}/exportar-pdf`, owner, {});
        expect(notProcessed.statusCode).toBe(409);

        await addPoint(owner, otherStudy, { papel: "ambos", latitude: -19.7476, longitude: -47.9318, tipo_ativo: "POSTE" });
        await recommend(otherStudy, "Outra recomendação");
        const mixed = await call("POST", `/estudos/${otherStudy}/exportar-pdf`, owner, { id_cenario: recommendation.id_cenario });
        expect(mixed.statusCode).toBe(404);
        expect(mixed.json().message).toMatch(/Cenário processado não encontrado/);
    });

    it("valida a imagem do mapa e o tamanho do envio", async () => {
        const notImage = await call("POST", `/estudos/${studyId}/exportar-pdf`, owner, { imagem_mapa: Buffer.from("<svg/>").toString("base64") });
        expect(notImage.statusCode).toBe(400);
        const tooLarge = await call("POST", `/estudos/${studyId}/exportar-pdf`, owner, { imagem_mapa: "A".repeat(16 * 1024 * 1024) });
        expect(tooLarge.statusCode).toBe(413);
    });
});
