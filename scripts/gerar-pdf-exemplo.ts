import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import type {
    ExportAsset,
    ExportCoveredAsset,
    ExportGateway,
    ExportScenario,
    StudyExportReport,
} from "../src/interface/StudyExportDTO.js";
import { buildExportFileName, formatAssetType } from "../src/utils/StudyExportUtils.js";
import { buildStudyReportPdf } from "../src/utils/StudyReportPdf.js";

type Rgb = [number, number, number];

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function drawDemoMap(gateways: Array<{ x: number; y: number }>, assets: Array<{ x: number; y: number; covered: boolean }>): Buffer {
    const width = 1000;
    const height = 520;
    const pixels = Buffer.alloc(width * height * 3);
    const set = (x: number, y: number, [r, g, b]: Rgb, alpha = 1) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (Math.round(y) * width + Math.round(x)) * 3;
        pixels[i] = Math.round(pixels[i]! * (1 - alpha) + r * alpha);
        pixels[i + 1] = Math.round(pixels[i + 1]! * (1 - alpha) + g * alpha);
        pixels[i + 2] = Math.round(pixels[i + 2]! * (1 - alpha) + b * alpha);
    };
    const disc = (cx: number, cy: number, radius: number, color: Rgb, alpha = 1) => {
        for (let y = cy - radius; y <= cy + radius; y += 1) {
            for (let x = cx - radius; x <= cx + radius; x += 1) {
                if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) set(x, y, color, alpha);
            }
        }
    };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const street = x % 90 < 6 || y % 70 < 6 || Math.abs(x - y * 1.6 - 120) < 4;
            set(x, y, street ? [32, 64, 56] : [14, 38, 33]);
        }
    }
    for (const gateway of gateways) disc(gateway.x, gateway.y, 125, [200, 241, 53], 0.13);
    for (const asset of assets) disc(asset.x, asset.y, 5, asset.covered ? [53, 214, 192] : [255, 152, 0]);
    for (const gateway of gateways) {
        disc(gateway.x, gateway.y, 13, [8, 28, 24]);
        disc(gateway.x, gateway.y, 10, [200, 241, 53]);
    }

    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y += 1) {
        raw[y * (width * 3 + 1)] = 0;
        pixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk("IHDR", header),
        pngChunk("IDAT", deflateSync(raw)),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
}

const tipos = ["TRANSFORMADOR", "RELIGADOR", "CHAVE_FUSIVEL", "REGULADOR_TENSAO"];
const prefixos: Record<string, string> = { TRANSFORMADOR: "TR", RELIGADOR: "RL", CHAVE_FUSIVEL: "CF", REGULADOR_TENSAO: "RT" };
const tipoDo = (i: number) => tipos[(i * 5 + Math.floor(i / 7)) % tipos.length]!;
const baseLat = -19.7476;
const baseLon = -47.9318;

const gatewaySpots = [
    { x: 210, y: 150 }, { x: 470, y: 120 }, { x: 760, y: 170 },
    { x: 300, y: 380 }, { x: 620, y: 360 }, { x: 860, y: 410 },
];
const assetSpots = Array.from({ length: 72 }, (_, i) => {
    const gateway = gatewaySpots[i % gatewaySpots.length]!;
    const angle = (i * 137.5 * Math.PI) / 180;
    const distance = 25 + ((i * 37) % 150);
    return { x: gateway.x + Math.cos(angle) * distance, y: gateway.y + Math.sin(angle) * distance * 0.8, gateway: i % gatewaySpots.length };
});
const coveredFlags = assetSpots.map((spot) => {
    const gateway = gatewaySpots[spot.gateway]!;
    return Math.hypot(spot.x - gateway.x, spot.y - gateway.y) <= 125;
});

const toCoordinates = (x: number, y: number) => ({
    latitude: Number((baseLat - y / 26000).toFixed(6)),
    longitude: Number((baseLon + x / 26000).toFixed(6)),
});

function buildScenario(options: {
    id: number; nome: string; rotulo: string; gatewayCount: number; otimizado: boolean; selecionado: boolean; executadoEm: Date; custoGateway: number; imagem: Buffer | null;
}): ExportScenario {
    const activeGateways = gatewaySpots.slice(0, options.gatewayCount);
    const gateways: ExportGateway[] = activeGateways.map((spot, index) => ({
        id_estudo_ponto: 100 + index,
        id_cenario_gateway: options.id * 10 + index,
        identificacao: `GW-${String(index + 14).padStart(2, "0")} · Poste MT ${88213 + index * 17}`,
        tipo_ativo: formatAssetType("POSTE"),
        ...toCoordinates(spot.x, spot.y),
        quantidade_atendidos: 0,
        capacidade_utilizada_pct: null,
        alcance_medio_m: 4200 - index * 150,
    }));

    const atendidos: ExportCoveredAsset[] = [];
    const naoAtendidos: ExportAsset[] = [];
    assetSpots.forEach((spot, index) => {
        const asset: ExportAsset = {
            id_estudo_ponto: 500 + index,
            identificacao: `${prefixos[tipoDo(index)]}-${1000 + index}`,
            tipo_ativo: formatAssetType(tipoDo(index)),
            ...toCoordinates(spot.x, spot.y),
        };
        const gateway = gateways[spot.gateway];
        if (gateway && coveredFlags[index]) {
            gateway.quantidade_atendidos += 1;
            const pixels = Math.hypot(spot.x - gatewaySpots[spot.gateway]!.x, spot.y - gatewaySpots[spot.gateway]!.y);
            atendidos.push({
                ...asset,
                gateway: gateway.identificacao,
                distancia_m: Math.round(pixels * 30),
                nivel_sinal_estimado_dbm: Math.round((-85 - pixels / 6) * 10) / 10,
            });
        } else {
            naoAtendidos.push(asset);
        }
    });

    const capacidadeMax = 40;
    for (const gateway of gateways) {
        gateway.capacidade_utilizada_pct = Math.round((gateway.quantidade_atendidos / capacidadeMax) * 1000) / 10;
    }

    const total = assetSpots.length;
    const categorias = tipos.map((codigo) => {
        const label = formatAssetType(codigo)!;
        const doTipo = (lista: ExportAsset[]) => lista.filter((asset) => asset.tipo_ativo === label).length;
        const atendidosTipo = doTipo(atendidos);
        const naoAtendidosTipo = doTipo(naoAtendidos);
        return { tipo_ativo: label, total: atendidosTipo + naoAtendidosTipo, atendidos: atendidosTipo, nao_atendidos: naoAtendidosTipo };
    }).sort((a, b) => b.total - a.total);

    return {
        id_cenario: options.id,
        nome: options.nome,
        rotulo: options.rotulo,
        otimizado: options.otimizado,
        selecionado: options.selecionado,
        descricao: null,
        objetivo: null,
        status: "DEFINITIVO",
        nome_perfil_rf: "GW-9200 · LoRaWAN",
        capacidade_max_equipamentos: capacidadeMax,
        perfil_rf: {
            nome: "GW-9200 · LoRaWAN", modelo_gateway: "GW-9200", frequencia_mhz: 915, potencia_transmissao_dbm: 8,
            sensibilidade_recepcao_dbm: -137, alcance_estimado_m: 4200, altura_gateway_m: 12, altura_dispositivo_m: 1.5,
            capacidade_max_equipamentos: capacidadeMax, quantidade_canais: 8, custo_estimado_gateway: options.custoGateway,
        },
        criterio: {
            nome: "Padrão urbano", distancia_minima_ativos_m: null, distancia_maxima_ativos_m: 40,
            altura_minima_m: null, limite_gateways: null, custo_maximo: null,
        },
        imagem_mapa: options.imagem,
        executado_em: options.executadoEm,
        indicadores: {
            quantidade_gateways: gateways.length,
            pontos_interesse: total,
            pontos_cobertos: atendidos.length,
            pontos_nao_cobertos: naoAtendidos.length,
            percentual_cobertura: Math.round((atendidos.length / total) * 100),
            capacidade_utilizada_media_pct: gateways.length > 0
                ? Math.round((gateways.reduce((sum, g) => sum + (g.capacidade_utilizada_pct ?? 0), 0) / gateways.length) * 10) / 10
                : null,
            custo_total_estimado: gateways.length * options.custoGateway,
        },
        por_categoria: categorias,
        gateways,
        ativos_atendidos: atendidos,
        ativos_nao_atendidos: naoAtendidos,
    };
}

async function main() {
    const [outputArg, mapArg] = process.argv.slice(2);
    const output = resolve(outputArg ?? "dist/relatorio-exemplo.pdf");
    const agora = new Date();

    const mapa = mapArg
        ? readFileSync(resolve(mapArg))
        : drawDemoMap(gatewaySpots, assetSpots.map((spot, index) => ({ ...spot, covered: coveredFlags[index]! })));
    const selecionado = buildScenario({ id: 3, nome: "Recomendação principal", rotulo: "Otimizada", gatewayCount: 6, otimizado: true, selecionado: true, executadoEm: agora, custoGateway: 1500, imagem: mapa });
    const report: StudyExportReport = {
        gerado_em: agora,
        estudo: {
            id_estudo: 14,
            nome: "Alimentador SUL-14 — Fase 1",
            descricao: "Estudo de cobertura LoRaWAN para telemetria dos ativos do alimentador SUL-14.",
            tipo_delimitacao: "selecao",
            regiao: "Zona Oeste, Uberaba - MG (Distribuidora: CEMIG-D)",
            uf: "MG",
            municipio: "Uberaba",
            bairro: "Zona Oeste",
            distribuidora: "CEMIG-D",
            versao_bdgd: "2024",
            status: "DEFINITIVO",
            nome_perfil_rf: "GW-9200 · LoRaWAN",
            nome_criterio_instalacao: "Padrão urbano",
            criado_em: new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
        cenario_selecionado: selecionado,
        outros_cenarios: [
            buildScenario({ id: 4, nome: "Alternativa econômica", rotulo: "Alt. 1", gatewayCount: 3, otimizado: false, selecionado: false, executadoEm: new Date(agora.getTime() - 86400000), custoGateway: 1500, imagem: mapa }),
            buildScenario({ id: 5, nome: "Alternativa intermediária", rotulo: "Alt. 2", gatewayCount: 4, otimizado: false, selecionado: false, executadoEm: new Date(agora.getTime() - 43200000), custoGateway: 1500, imagem: null }),
        ],
    };

    const pdf = await buildStudyReportPdf(report);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, pdf);
    console.log(`PDF de exemplo gerado: ${output}`);
    console.log(`(nome que a API daria ao arquivo: ${buildExportFileName(report.estudo.id_estudo, report.estudo.nome)})`);
}

main().catch((error: unknown) => {
    console.error("Falha ao gerar o PDF de exemplo:", error);
    process.exit(1);
});
