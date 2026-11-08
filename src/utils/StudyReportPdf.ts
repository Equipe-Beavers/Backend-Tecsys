import PDFDocument from "pdfkit";
import type { ExportScenario, StudyExportReport } from "../interface/StudyExportDTO.js";
import { sanitizeForPdf } from "./StudyExportUtils.js";

type Doc = PDFKit.PDFDocument;
type Align = "left" | "right" | "center";
interface Column { header: string; width: number; align?: Align }

const MARGIN = 40;
const COLORS = {
    primary: "#1F3A5F",
    accent: "#2E7D6B",
    danger: "#B3261E",
    text: "#1F2933",
    muted: "#616E7C",
    border: "#D9E2EC",
    headerFill: "#E8EEF5",
    zebra: "#F7F9FB",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});

function formatDate(value: Date | null): string {
    return value ? dateTime.format(value) : "-";
}

function formatNumber(value: number | null, digits = 0): string {
    if (value === null) return "-";
    return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPercent(value: number | null): string {
    return value === null ? "-" : `${formatNumber(value, Number.isInteger(value) ? 0 : 1)}%`;
}

function formatCurrency(value: number | null): string {
    return value === null ? "-" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCoordinate(value: number | null): string {
    return value === null ? "-" : value.toFixed(6);
}

function contentWidth(doc: Doc): number {
    return doc.page.width - MARGIN * 2;
}

function bottomLimit(doc: Doc): number {
    return doc.page.height - MARGIN - 20;
}

function ensureSpace(doc: Doc, height: number): void {
    if (doc.y + height > bottomLimit(doc)) doc.addPage();
}

function sectionTitle(doc: Doc, title: string): void {
    ensureSpace(doc, 50);
    doc.moveDown(0.8);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.primary).text(title, MARGIN, y);
    doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + contentWidth(doc), doc.y + 2)
        .lineWidth(1).strokeColor(COLORS.border).stroke();
    doc.moveDown(0.6);
}

function subTitle(doc: Doc, title: string): void {
    ensureSpace(doc, 40);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text).text(title, MARGIN, doc.y);
    doc.moveDown(0.3);
}

function keyValues(doc: Doc, items: Array<[string, string]>): void {
    const labelWidth = 150;
    for (const [label, value] of items) {
        const valueWidth = contentWidth(doc) - labelWidth;
        doc.font("Helvetica").fontSize(10);
        const height = Math.max(doc.heightOfString(value, { width: valueWidth }), 12) + 4;
        ensureSpace(doc, height);
        const y = doc.y;
        doc.font("Helvetica-Bold").fillColor(COLORS.muted).text(label, MARGIN, y, { width: labelWidth });
        doc.font("Helvetica").fillColor(COLORS.text).text(value, MARGIN + labelWidth, y, { width: valueWidth });
        doc.y = y + height;
    }
}

function indicatorCards(doc: Doc, cards: Array<{ label: string; value: string; color?: string }>): void {
    const perRow = 3;
    const gap = 10;
    const width = (contentWidth(doc) - gap * (perRow - 1)) / perRow;
    const height = 54;
    for (let index = 0; index < cards.length; index += perRow) {
        ensureSpace(doc, height + gap);
        const y = doc.y;
        cards.slice(index, index + perRow).forEach((card, column) => {
            const x = MARGIN + column * (width + gap);
            doc.roundedRect(x, y, width, height, 6).lineWidth(1).fillAndStroke(COLORS.zebra, COLORS.border);
            doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(card.label, x + 10, y + 9, { width: width - 20 });
            doc.font("Helvetica-Bold").fontSize(16).fillColor(card.color ?? COLORS.primary)
                .text(card.value, x + 10, y + 25, { width: width - 20 });
        });
        doc.y = y + height + gap;
    }
}

function table(doc: Doc, columns: Column[], rows: string[][], emptyMessage = "Nenhum registro."): void {
    const totalWidth = contentWidth(doc);
    const declared = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / declared) * totalWidth);
    const padding = 4;
    const fontSize = 8.5;

    const rowHeight = (cells: string[], font: string) => {
        doc.font(font).fontSize(fontSize);
        return Math.max(...cells.map((cell, index) =>
            doc.heightOfString(cell, { width: (widths[index] ?? 0) - padding * 2 }))) + padding * 2;
    };

    const drawRow = (cells: string[], font: string, fill: string | null, color: string) => {
        const height = rowHeight(cells, font);
        const y = doc.y;
        if (fill) doc.rect(MARGIN, y, totalWidth, height).fill(fill);
        let x = MARGIN;
        cells.forEach((cell, index) => {
            const width = widths[index] ?? 0;
            doc.font(font).fontSize(fontSize).fillColor(color)
                .text(cell, x + padding, y + padding, { width: width - padding * 2, align: columns[index]?.align ?? "left" });
            x += width;
        });
        doc.moveTo(MARGIN, y + height).lineTo(MARGIN + totalWidth, y + height)
            .lineWidth(0.5).strokeColor(COLORS.border).stroke();
        doc.y = y + height;
    };

    const headers = columns.map((column) => column.header);
    const drawHeader = () => drawRow(headers, "Helvetica-Bold", COLORS.headerFill, COLORS.primary);

    ensureSpace(doc, rowHeight(headers, "Helvetica-Bold") + 20);
    drawHeader();
    if (rows.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(fontSize).fillColor(COLORS.muted)
            .text(emptyMessage, MARGIN + padding, doc.y + padding, { width: totalWidth - padding * 2 });
        doc.moveDown(0.5);
        return;
    }
    rows.forEach((cells, index) => {
        if (doc.y + rowHeight(cells, "Helvetica") > bottomLimit(doc)) {
            doc.addPage();
            drawHeader();
        }
        drawRow(cells, "Helvetica", index % 2 === 1 ? COLORS.zebra : null, COLORS.text);
    });
    doc.moveDown(0.5);
}

function mapImage(doc: Doc, image: Buffer): void {
    let opened: { width: number; height: number };
    try {
        opened = (doc as unknown as { openImage(src: Buffer): { width: number; height: number } }).openImage(image);
    } catch {
        return;
    }
    const maxWidth = contentWidth(doc);
    const maxHeight = 300;
    const scale = Math.min(maxWidth / opened.width, maxHeight / opened.height);
    const width = opened.width * scale;
    const height = opened.height * scale;

    ensureSpace(doc, height + 24);
    const x = MARGIN + (maxWidth - width) / 2;
    const y = doc.y;
    doc.image(image, x, y, { width, height });
    doc.rect(x, y, width, height).lineWidth(1).strokeColor(COLORS.border).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
        .text("Área do estudo e gateways recomendados, como exibidos na aplicação. Mapa: © Mapbox © OpenStreetMap.",
            MARGIN, y + height + 4, { width: maxWidth, align: "center" });
    doc.moveDown(0.4);
}

function scenarioIndicators(doc: Doc, scenario: ExportScenario): void {
    const { indicadores } = scenario;
    indicatorCards(doc, [
        { label: "Gateways utilizados", value: formatNumber(indicadores.quantidade_gateways) },
        { label: "Percentual de cobertura", value: formatPercent(indicadores.percentual_cobertura), color: COLORS.accent },
        { label: "Capacidade utilizada (média)", value: formatPercent(indicadores.capacidade_utilizada_media_pct) },
        { label: "Ativos atendidos", value: formatNumber(indicadores.pontos_cobertos), color: COLORS.accent },
        { label: "Ativos não atendidos", value: formatNumber(indicadores.pontos_nao_cobertos), color: COLORS.danger },
        { label: "Total de ativos de interesse", value: formatNumber(indicadores.pontos_interesse) },
    ]);
}

function scenarioDetails(doc: Doc, scenario: ExportScenario): void {
    keyValues(doc, [
        ["Cenário", scenario.nome],
        ...(scenario.descricao ? [["Descrição", scenario.descricao] as [string, string]] : []),
        ["Perfil RF", scenario.nome_perfil_rf ?? "-"],
        ["Capacidade por gateway", scenario.capacidade_max_equipamentos !== null
            ? `${formatNumber(scenario.capacidade_max_equipamentos)} equipamentos` : "Não informada"],
        ["Custo total estimado", formatCurrency(scenario.indicadores.custo_total_estimado)],
        ["Processado em", formatDate(scenario.executado_em)],
    ]);
    doc.moveDown(0.4);
    scenarioIndicators(doc, scenario);

    subTitle(doc, "Cobertura por tipo de ativo");
    table(doc, [
        { header: "Tipo de ativo", width: 4 },
        { header: "Total", width: 2, align: "right" },
        { header: "Atendidos", width: 2, align: "right" },
        { header: "Não atendidos", width: 2, align: "right" },
        { header: "Cobertura", width: 2, align: "right" },
    ], scenario.por_categoria.map((category) => [
        category.tipo_ativo,
        formatNumber(category.total),
        formatNumber(category.atendidos),
        formatNumber(category.nao_atendidos),
        formatPercent(category.total > 0 ? Math.round((category.atendidos / category.total) * 1000) / 10 : 0),
    ]));

    subTitle(doc, `Gateways (${formatNumber(scenario.gateways.length)})`);
    table(doc, [
        { header: "#", width: 0.5, align: "right" },
        { header: "Identificação", width: 3 },
        { header: "Tipo", width: 2.8 },
        { header: "Latitude", width: 1.8, align: "right" },
        { header: "Longitude", width: 1.8, align: "right" },
        { header: "Atendidos", width: 1.5, align: "right" },
        { header: "Capacidade", width: 1.8, align: "right" },
        { header: "Alcance estimado", width: 1.8, align: "right" },
    ], scenario.gateways.map((gateway, index) => [
        String(index + 1),
        gateway.identificacao,
        gateway.tipo_ativo ?? "-",
        formatCoordinate(gateway.latitude),
        formatCoordinate(gateway.longitude),
        formatNumber(gateway.quantidade_atendidos),
        formatPercent(gateway.capacidade_utilizada_pct),
        gateway.alcance_medio_m === null ? "-" : `${formatNumber(gateway.alcance_medio_m)} m`,
    ]), "Nenhum gateway foi recomendado neste cenário.");

    subTitle(doc, `Ativos atendidos (${formatNumber(scenario.ativos_atendidos.length)})`);
    table(doc, [
        { header: "Identificação", width: 2.6 },
        { header: "Tipo", width: 2.8 },
        { header: "Latitude", width: 1.8, align: "right" },
        { header: "Longitude", width: 1.8, align: "right" },
        { header: "Gateway", width: 2.4 },
        { header: "Distância", width: 1.4, align: "right" },
        { header: "Sinal", width: 1.6, align: "right" },
    ], scenario.ativos_atendidos.map((asset) => [
        asset.identificacao,
        asset.tipo_ativo ?? "-",
        formatCoordinate(asset.latitude),
        formatCoordinate(asset.longitude),
        asset.gateway,
        asset.distancia_m === null ? "-" : `${formatNumber(asset.distancia_m)} m`,
        asset.nivel_sinal_estimado_dbm === null ? "-" : `${formatNumber(asset.nivel_sinal_estimado_dbm, 1)} dBm`,
    ]), "Nenhum ativo atendido neste cenário.");

    subTitle(doc, `Ativos não atendidos (${formatNumber(scenario.ativos_nao_atendidos.length)})`);
    table(doc, [
        { header: "Identificação", width: 4 },
        { header: "Tipo", width: 3 },
        { header: "Latitude", width: 2.2, align: "right" },
        { header: "Longitude", width: 2.2, align: "right" },
    ], scenario.ativos_nao_atendidos.map((asset) => [
        asset.identificacao,
        asset.tipo_ativo ?? "-",
        formatCoordinate(asset.latitude),
        formatCoordinate(asset.longitude),
    ]), "Todos os ativos de interesse foram atendidos.");
}

function header(doc: Doc, report: StudyExportReport): void {
    const width = contentWidth(doc);
    doc.rect(0, 0, doc.page.width, 92).fill(COLORS.primary);
    doc.font("Helvetica").fontSize(10).fillColor("#C9D6E3")
        .text("Relatório de planejamento de cobertura", MARGIN, 26, { width });
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#FFFFFF")
        .text(report.estudo.nome, MARGIN, 42, { width, height: 24, ellipsis: true });
    doc.font("Helvetica").fontSize(9).fillColor("#C9D6E3")
        .text(`Gerado em ${formatDate(report.gerado_em)}`, MARGIN, 68, { width });
    doc.y = 110;
}

function footer(doc: Doc, report: StudyExportReport): void {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const y = doc.page.height - MARGIN + 8;
        doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
            .text(`${report.estudo.nome} · gerado em ${formatDate(report.gerado_em)}`, MARGIN, y,
                { width: contentWidth(doc) * 0.7, lineBreak: false, ellipsis: true })
            .text(`Página ${index - range.start + 1} de ${range.count}`, MARGIN, y,
                { width: contentWidth(doc), align: "right", lineBreak: false });
        doc.page.margins.bottom = bottom;
    }
}

export function buildStudyReportPdf(input: StudyExportReport): Promise<Buffer> {
    const report = sanitizeForPdf(input);
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margin: MARGIN,
            bufferPages: true,
            info: {
                Title: `Relatório do estudo ${report.estudo.nome}`,
                Subject: "Resultados do planejamento de cobertura",
                CreationDate: report.gerado_em,
            },
        });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            const { estudo, cenario_final: finalScenario, alternativas } = report;
            header(doc, report);

            sectionTitle(doc, "Identificação do estudo");
            keyValues(doc, [
                ["Nome do estudo", estudo.nome],
                ...(estudo.descricao ? [["Descrição", estudo.descricao] as [string, string]] : []),
                ["Região analisada", estudo.regiao],
                ...(estudo.versao_bdgd ? [["Versão BDGD", estudo.versao_bdgd] as [string, string]] : []),
                ["Perfil RF", estudo.nome_perfil_rf ?? "-"],
                ["Critério de instalação", estudo.nome_criterio_instalacao ?? "-"],
                ["Criado em", formatDate(estudo.criado_em)],
                ["Data de geração", formatDate(report.gerado_em)],
            ]);

            if (report.imagem_mapa) {
                sectionTitle(doc, "Local do estudo");
                mapImage(doc, report.imagem_mapa);
            }

            if (alternativas.length > 0) {
                const all = [finalScenario, ...alternativas];
                sectionTitle(doc, "Comparativo das alternativas de implantação");
                table(doc, [
                    { header: "Alternativa", width: 3.6 },
                    { header: "Gateways", width: 1.5, align: "right" },
                    { header: "Cobertura", width: 1.6, align: "right" },
                    { header: "Atendidos", width: 1.6, align: "right" },
                    { header: "Não atendidos", width: 1.8, align: "right" },
                    { header: "Capacidade média", width: 1.9, align: "right" },
                    { header: "Custo estimado", width: 2.2, align: "right" },
                ], all.map((scenario) => [
                    scenario.final ? `${scenario.nome} (final)` : scenario.nome,
                    formatNumber(scenario.indicadores.quantidade_gateways),
                    formatPercent(scenario.indicadores.percentual_cobertura),
                    formatNumber(scenario.indicadores.pontos_cobertos),
                    formatNumber(scenario.indicadores.pontos_nao_cobertos),
                    formatPercent(scenario.indicadores.capacidade_utilizada_media_pct),
                    formatCurrency(scenario.indicadores.custo_total_estimado),
                ]));
            }

            sectionTitle(doc, `Alternativa final: ${finalScenario.nome}`);
            scenarioDetails(doc, finalScenario);

            for (const [index, scenario] of alternativas.entries()) {
                doc.addPage();
                doc.y = MARGIN;
                sectionTitle(doc, `Alternativa ${index + 2}: ${scenario.nome}`);
                scenarioDetails(doc, scenario);
            }

            footer(doc, report);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
