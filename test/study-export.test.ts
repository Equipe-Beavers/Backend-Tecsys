import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    findExportGatewaysQuery,
    findExportInterestPointsQuery,
    findExportScenariosQuery,
    findExportServicesQuery,
    findExportStudyQuery,
} from "../src/database/queries/export_queries.js";
import { StudyExportService } from "../src/services/StudyExportService.js";
import {
    buildExportFileName,
    decodeMapImage,
    describeRegion,
    formatAssetType,
    sanitizeForPdf,
    toPdfText,
} from "../src/utils/StudyExportUtils.js";
import { createTestApp } from "./helpers/create-test-app.js";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: database }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const study = {
    id_estudo: 5, nome: "Estudo Centro São José", descricao: "Planejamento piloto",
    tipo_delimitacao: "selecao", uf: "SP", municipio: "São José dos Campos", bairro: "Centro",
    distribuidora: "EDP SP", versao_bdgd: "2024", status: "DEFINITIVO",
    criado_em: new Date("2026-11-01T12:00:00Z"),
    nome_perfil_rf: "LoRa 915", nome_criterio_instalacao: "Postes urbanos",
};

const scenarios = [
    {
        id_cenario: 10, nome: "Recomendação inicial", descricao: null, status: "DEFINITIVO",
        quantidade_gateways: 2, pontos_interesse: 4, pontos_cobertos: 3, pontos_nao_cobertos: 1,
        percentual_cobertura: "75", capacidade_utilizada_media_pct: null, custo_total_estimado: "3000",
        executado_em: new Date("2026-11-02T10:00:00Z"), nome_perfil_rf: "LoRa 915", capacidade_max_equipamentos: 4,
    },
    {
        id_cenario: 11, nome: "Alternativa com 1 gateway", descricao: null, status: "DEFINITIVO",
        quantidade_gateways: 1, pontos_interesse: 4, pontos_cobertos: 2, pontos_nao_cobertos: 2,
        percentual_cobertura: "50", capacidade_utilizada_media_pct: "50", custo_total_estimado: "1500",
        executado_em: new Date("2026-11-03T10:00:00Z"), nome_perfil_rf: "LoRa 915", capacidade_max_equipamentos: 4,
    },
];

const gateways = [
    { id_cenario: 10, id_cenario_gateway: 100, id_estudo_ponto: 1, ordem: null, quantidade_pontos_atendidos: 2,
        capacidade_utilizada_pct: null, alcance_medio_m: 850.4, rotulo: "Poste P-01", id_ativo_bdgd: "P01",
        tipo_ativo: "POSTE", latitude: -23.18, longitude: -45.88 },
    { id_cenario: 10, id_cenario_gateway: 101, id_estudo_ponto: 2, ordem: null, quantidade_pontos_atendidos: 1,
        capacidade_utilizada_pct: null, alcance_medio_m: null, rotulo: null, id_ativo_bdgd: "P02",
        tipo_ativo: "POSTE", latitude: -23.19, longitude: -45.89 },
    { id_cenario: 11, id_cenario_gateway: 110, id_estudo_ponto: 1, ordem: 1, quantidade_pontos_atendidos: 2,
        capacidade_utilizada_pct: "50", alcance_medio_m: null, rotulo: "Poste P-01", id_ativo_bdgd: "P01",
        tipo_ativo: "POSTE", latitude: -23.18, longitude: -45.88 },
];

const interest = [
    { id_estudo_ponto: 20, rotulo: null, id_ativo_bdgd: "TR-1", tipo_ativo: "TRANSFORMADOR", latitude: -23.1, longitude: -45.8 },
    { id_estudo_ponto: 21, rotulo: null, id_ativo_bdgd: "TR-2", tipo_ativo: "TRANSFORMADOR", latitude: -23.2, longitude: -45.8 },
    { id_estudo_ponto: 22, rotulo: "Religador R1", id_ativo_bdgd: "RL-1", tipo_ativo: "RELIGADOR", latitude: -23.3, longitude: -45.8 },
    { id_estudo_ponto: 23, rotulo: null, id_ativo_bdgd: null, tipo_ativo: "RELIGADOR", latitude: -23.4, longitude: -45.8 },
];

function pick(id: number) {
    const { rotulo, id_ativo_bdgd, tipo_ativo, latitude, longitude } = interest.find((point) => point.id_estudo_ponto === id)!;
    return { rotulo, id_ativo_bdgd, tipo_ativo, latitude, longitude };
}

const services = [
    { id_cenario: 10, id_cenario_gateway: 100, id_estudo_ponto: 20, distancia_m: 120, nivel_sinal_estimado_dbm: -98.5, ...pick(20) },
    { id_cenario: 10, id_cenario_gateway: 100, id_estudo_ponto: 21, distancia_m: 300, nivel_sinal_estimado_dbm: -110.2, ...pick(21) },
    { id_cenario: 10, id_cenario_gateway: 101, id_estudo_ponto: 22, distancia_m: 80, nivel_sinal_estimado_dbm: -90, ...pick(22) },
    { id_cenario: 10, id_cenario_gateway: 101, id_estudo_ponto: 21, distancia_m: 500, nivel_sinal_estimado_dbm: -115, ...pick(21) },
    { id_cenario: 11, id_cenario_gateway: 110, id_estudo_ponto: 20, distancia_m: 120, nivel_sinal_estimado_dbm: -98.5, ...pick(20) },
    { id_cenario: 11, id_cenario_gateway: 110, id_estudo_ponto: 21, distancia_m: 300, nivel_sinal_estimado_dbm: -110.2, ...pick(21) },
];

function mockDatabase(options: { study?: unknown; scenarios?: unknown[] } = {}) {
    database.query.mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql === findExportStudyQuery) return { rows: options.study === null ? [] : [options.study ?? study] };
        if (sql === findExportScenariosQuery) return { rows: options.scenarios ?? scenarios };
        const ids = (params[0] as number[]) ?? [];
        if (sql === findExportGatewaysQuery) return { rows: gateways.filter((row) => ids.includes(row.id_cenario)) };
        if (sql === findExportServicesQuery) return { rows: services.filter((row) => ids.includes(row.id_cenario)) };
        if (sql === findExportInterestPointsQuery) return { rows: interest };
        throw new Error(`Consulta inesperada: ${sql}`);
    });
}

beforeEach(() => {
    database.query.mockReset();
});

describe("StudyExportService.getReport (recupera o estudo e os resultados)", () => {
    it("busca o estudo do usuário e usa o último cenário processado como alternativa final", async () => {
        mockDatabase();
        const report = await new StudyExportService().getReport(5, 1);

        expect(database.query).toHaveBeenCalledWith(findExportStudyQuery, [5, 1]);
        expect(report.estudo).toMatchObject({
            id_estudo: 5, nome: "Estudo Centro São José",
            regiao: "Centro, São José dos Campos - SP (Distribuidora: EDP SP)",
            nome_perfil_rf: "LoRa 915", nome_criterio_instalacao: "Postes urbanos",
        });
        expect(report.cenario_final.id_cenario).toBe(11);
        expect(report.alternativas).toEqual([]);
        expect(report.cenario_final.indicadores).toEqual({
            quantidade_gateways: 1, pontos_interesse: 4, pontos_cobertos: 2, pontos_nao_cobertos: 2,
            percentual_cobertura: 50, capacidade_utilizada_media_pct: 50, custo_total_estimado: 1500,
        });
        expect(database.query).toHaveBeenCalledWith(findExportGatewaysQuery, [[11]]);
    });

    it("organiza gateways, ativos cobertos e não cobertos do cenário escolhido", async () => {
        mockDatabase();
        const report = await new StudyExportService().getReport(5, 1, { id_cenario: 10, incluir_alternativas: true });
        const final = report.cenario_final;

        expect(final.id_cenario).toBe(10);
        expect(final.final).toBe(true);
        expect(final.gateways.map((gateway) => [gateway.identificacao, gateway.tipo_ativo, gateway.quantidade_atendidos, gateway.capacidade_utilizada_pct]))
            .toEqual([["Poste P-01", "Poste", 2, 50], ["P02", "Poste", 1, 25]]);
        expect(final.indicadores.capacidade_utilizada_media_pct).toBe(37.5);
        expect(final.ativos_atendidos.map((asset) => [asset.identificacao, asset.gateway]))
            .toEqual([["TR-1", "Poste P-01"], ["TR-2", "Poste P-01"], ["Religador R1", "P02"]]);
        expect(final.ativos_nao_atendidos.map((asset) => asset.identificacao)).toEqual(["Ponto 23"]);
        expect(final.por_categoria).toEqual([
            { tipo_ativo: "Transformador de Distribuição", total: 2, atendidos: 2, nao_atendidos: 0 },
            { tipo_ativo: "Religador", total: 2, atendidos: 1, nao_atendidos: 1 },
        ]);
    });

    it("inclui as alternativas de implantação quando pedido", async () => {
        mockDatabase();
        const report = await new StudyExportService().getReport(5, 1, { id_cenario: 10, incluir_alternativas: true });
        expect(report.alternativas.map((scenario) => [scenario.id_cenario, scenario.final])).toEqual([[11, false]]);
        expect(report.alternativas[0]?.ativos_nao_atendidos).toHaveLength(2);
    });

    it("lê a imagem do mapa enviada pelo front", async () => {
        mockDatabase();
        const report = await new StudyExportService().getReport(5, 1, { imagem_mapa: `data:image/png;base64,${PNG_1X1}` });
        expect(report.imagem_mapa?.subarray(1, 4).toString()).toBe("PNG");
    });

    it("recusa estudo sem resultados processados", async () => {
        mockDatabase({ scenarios: [] });
        await expect(new StudyExportService().getReport(5, 1)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("recusa cenário que não pertence ao estudo", async () => {
        mockDatabase();
        await expect(new StudyExportService().getReport(5, 1, { id_cenario: 999 })).rejects.toMatchObject({ statusCode: 404 });
    });

    it("recusa estudo de outro usuário ou inexistente", async () => {
        mockDatabase({ study: null });
        await expect(new StudyExportService().getReport(5, 1)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("recusa imagem inválida antes de consultar o banco", async () => {
        mockDatabase();
        await expect(new StudyExportService().getReport(5, 1, { imagem_mapa: Buffer.from("<svg/>").toString("base64") }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(database.query).not.toHaveBeenCalled();
    });
});

describe("auxiliares da exportação", () => {
    it("gera nome de arquivo sem acentos nem caracteres especiais", () => {
        expect(buildExportFileName(5, "Estudo Centro / São José!")).toBe("relatorio-estudo-5-estudo-centro-sao-jose.pdf");
        expect(buildExportFileName(5, "\u{1F680}")).toBe("relatorio-estudo-5.pdf");
    });

    it("descreve a região pela delimitação quando não há localização", () => {
        expect(describeRegion({ tipo_delimitacao: "desenho" })).toBe("Área desenhada no mapa");
        expect(describeRegion({})).toBe("Não informada");
    });

    it("mostra os tipos de ativo com os mesmos nomes da aplicação", () => {
        expect(formatAssetType("CHAVE_FUSIVEL")).toBe("Chave Fusível / Corta-Circuito");
        expect(formatAssetType("transformador")).toBe("Transformador de Distribuição");
        expect(formatAssetType("OUTRO_TIPO")).toBe("OUTRO_TIPO");
        expect(formatAssetType(null)).toBeNull();
    });

    it("aceita a imagem do mapa em PNG com ou sem prefixo data:", () => {
        expect(decodeMapImage(PNG_1X1)?.subarray(1, 4).toString()).toBe("PNG");
        expect(decodeMapImage(`data:image/png;base64,${PNG_1X1}`)?.length).toBeGreaterThan(8);
        expect(decodeMapImage(null)).toBeNull();
        expect(decodeMapImage("")).toBeNull();
        expect(() => decodeMapImage("não é base64!")).toThrow(/base64/);
        expect(() => decodeMapImage(Buffer.from("<svg/>").toString("base64"))).toThrow(/PNG ou JPEG/);
    });

    it("mantém acentos, aspas e travessão e troca o que a fonte do PDF não desenha", () => {
        expect(toPdfText("Alimentador SUL-14 — “Fase” 1: ação, €")).toBe("Alimentador SUL-14 — “Fase” 1: ação, €");
        expect(toPdfText("Raio ≥ 5 km → ok ✓")).toBe("Raio >= 5 km -> ok OK");
        expect(toPdfText("Estudo \u{1F680} centro 中文")).toBe("Estudo centro");
        expect(toPdfText("ﬁＡＢ ã")).toBe("fiAB ã");
    });

    it("limpa os textos do relatório sem mexer em números, datas e imagem", () => {
        const data = new Date("2026-11-07T12:00:00Z");
        const imagem = Buffer.from([1, 2, 3]);
        const result = sanitizeForPdf({ nome: "A \u{1F680} B", total: 3, quando: data, imagem, lista: ["x ≥ y", null] });
        expect(result).toEqual({ nome: "A B", total: 3, quando: data, imagem, lista: ["x >= y", null] });
        expect(result.quando).toBe(data);
        expect(result.imagem).toBe(imagem);
    });
});

describe("POST /estudos/:id/exportar-pdf", () => {
    it("devolve o PDF para download", async () => {
        mockDatabase();
        const app = createTestApp();

        const response = await app.inject({
            method: "POST", url: "/estudos/5/exportar-pdf",
            payload: { incluir_alternativas: true, imagem_mapa: `data:image/png;base64,${PNG_1X1}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"])
            .toBe('attachment; filename="relatorio-estudo-5-estudo-centro-sao-jose.pdf"');
        expect(response.headers["access-control-expose-headers"]).toBe("Content-Disposition");
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
        await app.close();
    });

    it("aceita pedido sem corpo (usa o último cenário)", async () => {
        mockDatabase();
        const app = createTestApp();
        const response = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf" });
        expect(response.statusCode).toBe(200);
        await app.close();
    });

    it("responde 409 quando o estudo ainda não foi processado", async () => {
        mockDatabase({ scenarios: [] });
        const app = createTestApp();

        const response = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf" });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toMatch(/resultados processados/);
        await app.close();
    });

    it("responde 400 para campos desconhecidos, imagem inválida e id inválido", async () => {
        mockDatabase();
        const app = createTestApp();

        const unknown = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf", payload: { formato: "xlsx" } });
        expect(unknown.statusCode).toBe(400);
        const image = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf", payload: { imagem_mapa: Buffer.from("texto").toString("base64") } });
        expect(image.statusCode).toBe(400);
        expect(image.json().message).toMatch(/PNG ou JPEG/);
        const id = await app.inject({ method: "POST", url: "/estudos/abc/exportar-pdf" });
        expect(id.statusCode).toBe(400);
        await app.close();
    });

    it("responde 413 para envio grande demais", async () => {
        const app = createTestApp();
        const response = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf", payload: { imagem_mapa: "A".repeat(16 * 1024 * 1024) } });
        expect(response.statusCode).toBe(413);
        await app.close();
    });

    it("exige login", async () => {
        const { App } = await import("../src/app.js");
        const app = new App({ authSecret: "unit-test-secret-of-at-least-thirty-two-bytes" }).getInstance();

        const response = await app.inject({ method: "POST", url: "/estudos/5/exportar-pdf" });

        expect(response.statusCode).toBe(401);
        expect(database.query).not.toHaveBeenCalled();
        await app.close();
    });
});
