import type { ExportAsset } from "../interface/StudyExportDTO.js";
import { StudyError } from "./StudyError.js";

export type Row = Record<string, unknown>;

export function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function toText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
}

export function toDate(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

export function round(value: number, digits = 1): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

const assetTypeLabels: Record<string, string> = {
    POSTE: "Poste",
    TRANSFORMADOR: "Transformador de Distribuição",
    SUBESTACAO: "Subestação",
    DISPOSITIVO: "Dispositivo",
    CHAVE_FUSIVEL: "Chave Fusível / Corta-Circuito",
    CHAVE_SECCIONADORA: "Chave Seccionadora",
    RELIGADOR: "Religador",
    SECCIONADOR_AUTOMATICO: "Seccionador Automático",
    REGULADOR_TENSAO: "Regulador de Tensão",
    BANCO_CAPACITORES: "Banco de Capacitores",
};

export function formatAssetType(value: unknown): string | null {
    const code = toText(value);
    if (!code) return null;
    return assetTypeLabels[code.toUpperCase()] ?? code;
}

export function mapAsset(row: Row): ExportAsset {
    const id = Number(row.id_estudo_ponto);
    return {
        id_estudo_ponto: id,
        identificacao: toText(row.rotulo) ?? toText(row.id_ativo_bdgd) ?? `Ponto ${id}`,
        tipo_ativo: formatAssetType(row.tipo_ativo),
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
    };
}

export function describeRegion(study: Row): string {
    const place = [toText(study.bairro), toText(study.municipio)].filter(Boolean).join(", ");
    const uf = toText(study.uf);
    const local = place && uf ? `${place} - ${uf}` : place || uf || "";
    const distribuidora = toText(study.distribuidora);
    if (local && distribuidora) return `${local} (Distribuidora: ${distribuidora})`;
    if (local) return local;
    if (distribuidora) return `Distribuidora: ${distribuidora}`;
    const delimitacao: Record<string, string> = {
        desenho: "Área desenhada no mapa",
        selecao: "Área selecionada no mapa",
        mancha: "Área definida por mancha",
    };
    return delimitacao[String(study.tipo_delimitacao)] ?? "Não informada";
}

export function decodeMapImage(value: string | null | undefined): Buffer | null {
    if (value === null || value === undefined || value.trim() === "") return null;
    const base64 = value.trim().replace(/^data:image\/(png|jpe?g);base64,/i, "");
    if (!/^[A-Za-z0-9+/\s]+={0,2}$/.test(base64)) {
        throw new StudyError(400, "A imagem do mapa deve estar em base64.");
    }
    const image = Buffer.from(base64, "base64");
    const isPng = image.length > 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    if (!isPng && !isJpeg) throw new StudyError(400, "A imagem do mapa deve ser PNG ou JPEG.");
    return image;
}

export function buildExportFileName(idStudy: number, studyName: string): string {
    const slug = studyName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    return `relatorio-estudo-${idStudy}${slug ? `-${slug}` : ""}.pdf`;
}

const winAnsiExtras = new Set([
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
    0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const pdfReplacements = new Map<number, string>([
    [0x2265, ">="], [0x2264, "<="], [0x2260, "!="], [0x2248, "~"], [0x2212, "-"], [0x2010, "-"], [0x2011, "-"],
    [0x2192, "->"], [0x2190, "<-"], [0x2194, "<->"], [0x21d2, "=>"], [0x2032, "'"], [0x2033, "\""], [0x2116, "No"],
    [0x2713, "OK"], [0x2714, "OK"], [0x2705, "OK"], [0x2717, "X"], [0x2718, "X"], [0x274c, "X"],
]);

function isWinAnsi(codePoint: number): boolean {
    return codePoint === 0x0a || (codePoint >= 0x20 && codePoint <= 0x7e)
        || (codePoint >= 0xa0 && codePoint <= 0xff) || winAnsiExtras.has(codePoint);
}

export function toPdfText(text: string): string {
    let result = "";
    for (const char of text.normalize("NFC")) {
        const codePoint = char.codePointAt(0)!;
        if (codePoint === 0x09 || codePoint === 0x0d) result += " ";
        else if (isWinAnsi(codePoint)) result += char;
        else if (pdfReplacements.has(codePoint)) result += pdfReplacements.get(codePoint);
        else {
            const compatible = char.normalize("NFKC");
            if ([...compatible].every((c) => isWinAnsi(c.codePointAt(0)!))) result += compatible;
        }
    }
    return result.replace(/ {2,}/g, " ").replace(/ +$/gm, "").replace(/^ +/gm, "");
}

export function sanitizeForPdf<T>(value: T): T {
    if (typeof value === "string") return toPdfText(value) as T;
    if (Array.isArray(value)) return value.map((item) => sanitizeForPdf(item)) as T;
    if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeForPdf(item)])) as T;
    }
    return value;
}
