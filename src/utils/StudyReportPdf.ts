import PDFDocument from "pdfkit";
import type { ExportCriterion, ExportRfProfile, ExportScenario, StudyExportReport } from "../interface/StudyExportDTO.js";
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
    gateway: "#C8F135",
    covered: "#35D6C0",
    uncovered: "#FF9800",
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

function legend(doc: Doc): void {
    const items: Array<[string, string]> = [
        [COLORS.gateway, "Gateway proposto"],
        [COLORS.covered, "Ativo coberto"],
        [COLORS.uncovered, "Sem cobertura"],
    ];
    ensureSpace(doc, 20);
    let x = MARGIN;
    const y = doc.y;
    doc.font("Helvetica").fontSize(8.5);
    for (const [color, label] of items) {
        doc.circle(x + 5, y + 5, 4).fillAndStroke(color, COLORS.muted);
        doc.fillColor(COLORS.text).text(label, x + 14, y + 1, { lineBreak: false });
        x += 14 + doc.widthOfString(label) + 18;
    }
    doc.y = y + 18;
}

function mapSection(doc: Doc, scenario: ExportScenario): void {
    const image = scenario.imagem_mapa;
    let opened: { width: number; height: number } | null = null;
    if (image) {
        try {
            opened = (doc as unknown as { openImage(src: Buffer): { width: number; height: number } }).openImage(image);
        } catch {
            opened = null;
        }
    }
    if (!image || !opened) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLORS.muted)
            .text("A imagem do mapa deste cenário não foi enviada pela aplicação no momento da exportação.", MARGIN, doc.y, { width: contentWidth(doc) });
        doc.moveDown(0.6);
        return;
    }
    const maxWidth = contentWidth(doc);
    const maxHeight = 360;
    const scale = Math.min(maxWidth / opened.width, maxHeight / opened.height);
    const width = opened.width * scale;
    const height = opened.height * scale;

    ensureSpace(doc, height + 40);
    const x = MARGIN + (maxWidth - width) / 2;
    const y = doc.y;
    doc.image(image, x, y, { width, height });
    doc.rect(x, y, width, height).lineWidth(1).strokeColor(COLORS.border).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
        .text(`Mapa do cenário ${scenario.rotulo}: gateways propostos e ativos, como exibidos na aplicação.`,
            MARGIN, y + height + 4, { width: maxWidth, align: "center" });
    doc.y = y + height + 20;
    legend(doc);
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

function optional(label: string, value: string | null): Array<[string, string]> {
    return value === null ? [] : [[label, value]];
}

function rfParameters(profile: ExportRfProfile | null): Array<[string, string]> {
    if (!profile) return [["Perfil de radiofrequência", "Não informado"]];
    const unit = (value: number | null, suffix: string, digits = 0) =>
        value === null ? null : `${formatNumber(value, digits)} ${suffix}`.trim();
    return [
        ["Perfil de radiofrequência", profile.nome ?? "-"],
        ...optional("Modelo do gateway", profile.modelo_gateway),
        ...optional("Frequência", unit(profile.frequencia_mhz, "MHz", 1)),
        ...optional("Potência de transmissão", unit(profile.potencia_transmissao_dbm, "dBm", 1)),
        ...optional("Sensibilidade de recepção", unit(profile.sensibilidade_recepcao_dbm, "dBm", 1)),
        ...optional("Alcance estimado", unit(profile.alcance_estimado_m, "m")),
        ...optional("Altura do gateway", unit(profile.altura_gateway_m, "m", 1)),
        ...optional("Altura do dispositivo", unit(profile.altura_dispositivo_m, "m", 1)),
        ...optional("Capacidade por gateway", unit(profile.capacidade_max_equipamentos, "equipamentos")),
        ...optional("Quantidade de canais", unit(profile.quantidade_canais, "")),
        ...optional("Custo estimado por gateway", profile.custo_estimado_gateway === null ? null : formatCurrency(profile.custo_estimado_gateway)),
    ];
}

function criterionParameters(criterion: ExportCriterion | null): Array<[string, string]> {
    if (!criterion) return [["Critério de instalação", "Nenhum critério associado"]];
    const unit = (value: number | null, suffix: string) =>
        value === null ? null : `${formatNumber(value, 0)} ${suffix}`.trim();
    return [
        ["Critério de instalação", criterion.nome ?? "-"],
        ...optional("Distância mínima aos ativos", unit(criterion.distancia_minima_ativos_m, "m")),
        ...optional("Distância máxima aos ativos", unit(criterion.distancia_maxima_ativos_m, "m")),
        ...optional("Altura mínima", unit(criterion.altura_minima_m, "m")),
        ...optional("Limite de gateways", unit(criterion.limite_gateways, "")),
        ...optional("Custo máximo", criterion.custo_maximo === null ? null : formatCurrency(criterion.custo_maximo)),
    ];
}

function categoriesTable(doc: Doc, scenario: ExportScenario): void {
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
}

function gatewaysTable(doc: Doc, scenario: ExportScenario): void {
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
}

function assetTables(doc: Doc, scenario: ExportScenario): void {
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

function scenarioBlock(doc: Doc, scenario: ExportScenario): void {
    keyValues(doc, [
        ["Cenário", `${scenario.rotulo} - ${scenario.nome}`],
        ...(scenario.descricao ? [["Descrição", scenario.descricao] as [string, string]] : []),
        ["Perfil RF", scenario.nome_perfil_rf ?? "-"],
        ["Capacidade por gateway", scenario.capacidade_max_equipamentos !== null
            ? `${formatNumber(scenario.capacidade_max_equipamentos)} equipamentos` : "Não informada"],
        ["Custo total estimado", formatCurrency(scenario.indicadores.custo_total_estimado)],
        ["Processado em", formatDate(scenario.executado_em)],
    ]);
    doc.moveDown(0.4);
    scenarioIndicators(doc, scenario);
    subTitle(doc, "Mapa geográfico");
    mapSection(doc, scenario);
    subTitle(doc, "Cobertura por tipo de ativo");
    categoriesTable(doc, scenario);
    subTitle(doc, `Gateways propostos (${formatNumber(scenario.gateways.length)})`);
    gatewaysTable(doc, scenario);
    assetTables(doc, scenario);
}

function paragraph(doc: Doc, text: string): void {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
    ensureSpace(doc, doc.heightOfString(text, { width: contentWidth(doc) }) + 6);
    doc.text(text, MARGIN, doc.y, { width: contentWidth(doc) });
    doc.moveDown(0.5);
}

function finalConsiderations(doc: Doc, report: StudyExportReport): void {
    const main = report.cenario_selecionado;
    const { indicadores } = main;
    paragraph(doc, `No estudo "${report.estudo.nome}", o cenário ${main.rotulo} (${main.nome}) utiliza `
        + `${formatNumber(indicadores.quantidade_gateways)} gateway(s) e atende ${formatNumber(indicadores.pontos_cobertos)} de `
        + `${formatNumber(indicadores.pontos_interesse)} ativos de interesse (${formatPercent(indicadores.percentual_cobertura)} de cobertura).`);

    const pending = main.por_categoria.filter((category) => category.nao_atendidos > 0);
    if (pending.length > 0) {
        paragraph(doc, "Ativos sem cobertura por tipo: "
            + pending.map((category) => `${category.tipo_ativo} (${formatNumber(category.nao_atendidos)})`).join("; ") + ".");
    } else if (indicadores.pontos_interesse > 0) {
        paragraph(doc, "Todos os ativos de interesse foram atendidos neste cenário.");
    }
    if (indicadores.capacidade_utilizada_media_pct !== null) {
        paragraph(doc, `A utilização média da capacidade dos gateways é de ${formatPercent(indicadores.capacidade_utilizada_media_pct)}.`);
    }

    const all = [main, ...report.outros_cenarios];
    if (all.length > 1) {
        const bestCoverage = Math.max(...all.map((scenario) => scenario.indicadores.percentual_cobertura));
        const fewest = Math.min(...all.map((scenario) => scenario.indicadores.quantidade_gateways));
        const names = (predicate: (scenario: ExportScenario) => boolean) =>
            all.filter(predicate).map((scenario) => scenario.rotulo).join(", ");
        paragraph(doc, `Entre os ${all.length} cenários comparados, a maior cobertura (${formatPercent(bestCoverage)}) é de: `
            + `${names((scenario) => scenario.indicadores.percentual_cobertura === bestCoverage)}; o menor número de gateways `
            + `(${formatNumber(fewest)}) é de: ${names((scenario) => scenario.indicadores.quantidade_gateways === fewest)}.`);
    }
    doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(COLORS.muted)
        .text("Os resultados refletem os dados processados na aplicação na data de geração deste relatório.",
            MARGIN, doc.y, { width: contentWidth(doc) });
}

function header(doc: Doc, report: StudyExportReport): void {
    const width = contentWidth(doc);
    doc.rect(0, 0, doc.page.width, 100).fill(COLORS.primary);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.gateway)
        .text("GEOMASH", MARGIN, 22, { width, characterSpacing: 1.5 });
    doc.font("Helvetica").fontSize(10).fillColor("#C9D6E3")
        .text("Relatório de planejamento de cobertura", MARGIN, 36, { width });
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#FFFFFF")
        .text(report.estudo.nome, MARGIN, 52, { width, height: 24, ellipsis: true });
    doc.font("Helvetica").fontSize(9).fillColor("#C9D6E3")
        .text(`Estudo nº ${report.estudo.id_estudo} · Gerado em ${formatDate(report.gerado_em)}`, MARGIN, 78, { width });
    doc.y = 118;
}

function pageDecorations(doc: Doc, report: StudyExportReport): void {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottom = doc.page.margins.bottom;
        const top = doc.page.margins.top;
        doc.page.margins.bottom = 0;
        doc.page.margins.top = 0;
        if (index > range.start) {
            doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primary)
                .text("GEOMASH", MARGIN, 20, { width: 60, lineBreak: false });
            doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
                .text(`Estudo nº ${report.estudo.id_estudo} · ${report.estudo.nome}`, MARGIN + 60, 20,
                    { width: contentWidth(doc) - 60, align: "right", lineBreak: false, ellipsis: true });
            doc.moveTo(MARGIN, 32).lineTo(MARGIN + contentWidth(doc), 32).lineWidth(0.5).strokeColor(COLORS.border).stroke();
        }
        const y = doc.page.height - MARGIN + 8;
        doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
            .text(`${report.estudo.nome} · gerado em ${formatDate(report.gerado_em)}`, MARGIN, y,
                { width: contentWidth(doc) * 0.7, lineBreak: false, ellipsis: true })
            .text(`Página ${index - range.start + 1} de ${range.count}`, MARGIN, y,
                { width: contentWidth(doc), align: "right", lineBreak: false });
        doc.page.margins.bottom = bottom;
        doc.page.margins.top = top;
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
            const { estudo, cenario_selecionado: main, outros_cenarios: others } = report;
            header(doc, report);

            sectionTitle(doc, "1. Identificação do estudo");
            keyValues(doc, [
                ["Nome do estudo", estudo.nome],
                ["Identificador", String(estudo.id_estudo)],
                ["Região analisada", estudo.regiao],
                ...optional("Distribuidora", estudo.distribuidora),
                ...(estudo.descricao ? [["Descrição", estudo.descricao] as [string, string]] : []),
                ...optional("Versão BDGD", estudo.versao_bdgd),
                ["Cenário exibido", `${main.rotulo} - ${main.nome}`],
                ["Criado em", formatDate(estudo.criado_em)],
                ["Data de geração", formatDate(report.gerado_em)],
            ]);

            sectionTitle(doc, "2. Informações gerais");
            keyValues(doc, [...rfParameters(main.perfil_rf), ...criterionParameters(main.criterio)]);

            sectionTitle(doc, `3. Resumo dos resultados - ${main.rotulo}`);
            scenarioIndicators(doc, main);
            keyValues(doc, [["Custo total estimado", formatCurrency(main.indicadores.custo_total_estimado)]]);

            sectionTitle(doc, "4. Mapa geográfico");
            mapSection(doc, main);

            sectionTitle(doc, `5. Gateways propostos (${formatNumber(main.gateways.length)})`);
            gatewaysTable(doc, main);

            sectionTitle(doc, "6. Ativos elétricos");
            subTitle(doc, "Cobertura por tipo de ativo");
            categoriesTable(doc, main);
            assetTables(doc, main);

            let number = 7;
            if (others.length > 0) {
                doc.addPage();
                sectionTitle(doc, `${number}. Demais cenários do estudo`);
                number += 1;
                others.forEach((scenario, index) => {
                    if (index > 0) doc.addPage();
                    subTitle(doc, `${scenario.rotulo} - ${scenario.nome}`);
                    scenarioBlock(doc, scenario);
                });

                const all = [main, ...others].sort((a, b) =>
                    Number(b.otimizado) - Number(a.otimizado) || a.id_cenario - b.id_cenario);
                sectionTitle(doc, `${number}. Comparativo entre cenários`);
                number += 1;
                table(doc, [
                    { header: "Cenário", width: 3.6 },
                    { header: "Gateways", width: 1.5, align: "right" },
                    { header: "Cobertura", width: 1.6, align: "right" },
                    { header: "Atendidos", width: 1.6, align: "right" },
                    { header: "Não atendidos", width: 1.8, align: "right" },
                    { header: "Capacidade média", width: 1.9, align: "right" },
                    { header: "Custo estimado", width: 2.2, align: "right" },
                ], all.map((scenario) => [
                    `${scenario.rotulo} - ${scenario.nome}${scenario.selecionado ? " (exibido)" : ""}`,
                    formatNumber(scenario.indicadores.quantidade_gateways),
                    formatPercent(scenario.indicadores.percentual_cobertura),
                    formatNumber(scenario.indicadores.pontos_cobertos),
                    formatNumber(scenario.indicadores.pontos_nao_cobertos),
                    formatPercent(scenario.indicadores.capacidade_utilizada_media_pct),
                    formatCurrency(scenario.indicadores.custo_total_estimado),
                ]));
            }

            sectionTitle(doc, `${number}. Considerações finais`);
            finalConsiderations(doc, report);

            pageDecorations(doc, report);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
