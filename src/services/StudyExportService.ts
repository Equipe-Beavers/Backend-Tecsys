import { pool } from "../database/pool.js";
import {
    findExportGatewaysQuery,
    findExportInterestPointsQuery,
    findExportScenariosQuery,
    findExportServicesQuery,
    findExportStudyQuery,
} from "../database/queries/export_queries.js";
import type {
    ExportAsset,
    ExportCategory,
    ExportCoveredAsset,
    ExportGateway,
    ExportScenario,
    ExportStudyInfo,
    StudyExportQuery,
    StudyExportReport,
} from "../interface/StudyExportDTO.js";
import { StudyError } from "../utils/StudyError.js";
import {
    buildExportFileName,
    decodeMapImage,
    describeRegion,
    mapAsset,
    round,
    toDate,
    toNumber,
    toText,
    type Row,
} from "../utils/StudyExportUtils.js";
import { buildStudyReportPdf } from "../utils/StudyReportPdf.js";

export interface StudyExportFile {
    fileName: string;
    content: Buffer;
}

export class StudyExportService {
    async getReport(idStudy: number, userId: number, options: StudyExportQuery = {}): Promise<StudyExportReport> {
        const selectedImage = decodeMapImage(options.imagem_mapa);
        const otherImages = new Map<number, Buffer>();
        for (const [id, value] of Object.entries(options.imagens_mapa ?? {})) {
            const image = decodeMapImage(value);
            if (image) otherImages.set(Number(id), image);
        }

        const studyResult = await pool.query(findExportStudyQuery, [idStudy, userId]);
        const studyRow = studyResult.rows[0] as Row | undefined;
        if (!studyRow) throw new StudyError(404, "Estudo não encontrado.");

        const scenariosResult = await pool.query(findExportScenariosQuery, [idStudy]);
        const scenarioRows = scenariosResult.rows as Row[];
        if (scenarioRows.length === 0) {
            throw new StudyError(409, "O estudo ainda não possui resultados processados para exportar.");
        }

        const studyScenarioIds = new Set(scenarioRows.map((row) => Number(row.id_cenario)));
        for (const id of otherImages.keys()) {
            if (!studyScenarioIds.has(id)) {
                throw new StudyError(400, `A imagem enviada para o cenário ${id} não pertence a este estudo.`);
            }
        }

        // O otimizado é a recomendação automática: cenário sem base de menor id.
        // Os demais, na ordem de criação, são Alt. 1, Alt. 2...
        const byId = [...scenarioRows].sort((a, b) => Number(a.id_cenario) - Number(b.id_cenario));
        const optimizedRow = byId.find((row) => row.id_cenario_base === null || row.id_cenario_base === undefined) ?? byId[0]!;
        const labels = new Map<number, string>([[Number(optimizedRow.id_cenario), "Otimizada"]]);
        byId.filter((row) => row !== optimizedRow).forEach((row, index) => {
            labels.set(Number(row.id_cenario), `Alt. ${index + 1}`);
        });

        let selectedRow = optimizedRow;
        if (options.id_cenario !== undefined) {
            const found = byId.find((row) => Number(row.id_cenario) === Number(options.id_cenario));
            if (!found) throw new StudyError(404, "Cenário processado não encontrado neste estudo.");
            selectedRow = found;
        }
        const otherRows = options.incluir_alternativas !== false ? byId.filter((row) => row !== selectedRow) : [];
        const selectedRows = [selectedRow, ...otherRows];
        const scenarioIds = selectedRows.map((row) => Number(row.id_cenario));

        const [gatewaysResult, servicesResult, interestResult] = await Promise.all([
            pool.query(findExportGatewaysQuery, [scenarioIds]),
            pool.query(findExportServicesQuery, [scenarioIds]),
            pool.query(findExportInterestPointsQuery, [idStudy]),
        ]);
        const interestPoints = (interestResult.rows as Row[]).map(mapAsset);

        const scenarios = selectedRows.map((row) => {
            const id = Number(row.id_cenario);
            return this.buildScenario(
                row,
                (gatewaysResult.rows as Row[]).filter((item) => Number(item.id_cenario) === id),
                (servicesResult.rows as Row[]).filter((item) => Number(item.id_cenario) === id),
                interestPoints,
                {
                    rotulo: labels.get(id) ?? `Cenário ${id}`,
                    otimizado: row === optimizedRow,
                    selecionado: row === selectedRow,
                    // Cada mapa pertence a um único cenário; nunca é reaproveitado em outro.
                    imagem: row === selectedRow ? (selectedImage ?? otherImages.get(id) ?? null) : (otherImages.get(id) ?? null),
                },
            );
        });

        const estudo: ExportStudyInfo = {
            id_estudo: Number(studyRow.id_estudo),
            nome: toText(studyRow.nome) ?? `Estudo ${idStudy}`,
            descricao: toText(studyRow.descricao),
            tipo_delimitacao: String(studyRow.tipo_delimitacao ?? ""),
            regiao: describeRegion(studyRow),
            uf: toText(studyRow.uf),
            municipio: toText(studyRow.municipio),
            bairro: toText(studyRow.bairro),
            distribuidora: toText(studyRow.distribuidora),
            versao_bdgd: toText(studyRow.versao_bdgd),
            status: String(studyRow.status ?? ""),
            nome_perfil_rf: toText(studyRow.nome_perfil_rf),
            nome_criterio_instalacao: toText(studyRow.nome_criterio_instalacao),
            criado_em: toDate(studyRow.criado_em),
        };

        const [cenarioSelecionado, ...outros] = scenarios;
        return { gerado_em: new Date(), estudo, cenario_selecionado: cenarioSelecionado!, outros_cenarios: outros };
    }

    async exportPdf(idStudy: number, userId: number, options: StudyExportQuery = {}): Promise<StudyExportFile> {
        const report = await this.getReport(idStudy, userId, options);
        return {
            fileName: buildExportFileName(report.estudo.id_estudo, report.estudo.nome),
            content: await buildStudyReportPdf(report),
        };
    }

    private buildScenario(
        row: Row,
        gatewayRows: Row[],
        serviceRows: Row[],
        interestPoints: ExportAsset[],
        meta: { rotulo: string; otimizado: boolean; selecionado: boolean; imagem: Buffer | null },
    ): ExportScenario {
        const capacityMax = toNumber(row.capacidade_max_equipamentos);

        const gateways: ExportGateway[] = gatewayRows.map((gateway) => {
            const served = toNumber(gateway.quantidade_pontos_atendidos)
                ?? serviceRows.filter((service) => Number(service.id_cenario_gateway) === Number(gateway.id_cenario_gateway)).length;
            const storedCapacity = toNumber(gateway.capacidade_utilizada_pct);
            return {
                ...mapAsset(gateway),
                id_cenario_gateway: Number(gateway.id_cenario_gateway),
                quantidade_atendidos: served,
                capacidade_utilizada_pct: storedCapacity !== null
                    ? round(storedCapacity)
                    : capacityMax && capacityMax > 0 ? round((served / capacityMax) * 100) : null,
                alcance_medio_m: toNumber(gateway.alcance_medio_m),
            };
        });
        const gatewayNames = new Map(gateways.map((gateway) => [gateway.id_cenario_gateway, gateway.identificacao]));

        const covered = new Map<number, ExportCoveredAsset>();
        for (const service of serviceRows) {
            const asset = mapAsset(service);
            if (covered.has(asset.id_estudo_ponto)) continue;
            covered.set(asset.id_estudo_ponto, {
                ...asset,
                gateway: gatewayNames.get(Number(service.id_cenario_gateway)) ?? `Gateway ${String(service.id_cenario_gateway)}`,
                distancia_m: toNumber(service.distancia_m),
                nivel_sinal_estimado_dbm: toNumber(service.nivel_sinal_estimado_dbm),
            });
        }
        const notCovered = interestPoints.filter((point) => !covered.has(point.id_estudo_ponto));

        const categories = new Map<string, ExportCategory>();
        for (const point of interestPoints) {
            const tipo = point.tipo_ativo ?? "Não informado";
            const category = categories.get(tipo) ?? { tipo_ativo: tipo, total: 0, atendidos: 0, nao_atendidos: 0 };
            category.total += 1;
            if (covered.has(point.id_estudo_ponto)) category.atendidos += 1;
            else category.nao_atendidos += 1;
            categories.set(tipo, category);
        }

        const gatewayCapacities = gateways
            .map((gateway) => gateway.capacidade_utilizada_pct)
            .filter((value): value is number => value !== null);
        const storedAverage = toNumber(row.capacidade_utilizada_media_pct);
        const coveredCount = toNumber(row.pontos_cobertos) ?? covered.size;
        const notCoveredCount = toNumber(row.pontos_nao_cobertos) ?? notCovered.length;
        const interestCount = toNumber(row.pontos_interesse) ?? coveredCount + notCoveredCount;

        return {
            id_cenario: Number(row.id_cenario),
            nome: toText(row.nome) ?? `Cenário ${String(row.id_cenario)}`,
            rotulo: meta.rotulo,
            otimizado: meta.otimizado,
            selecionado: meta.selecionado,
            descricao: toText(row.descricao),
            objetivo: toText(row.objetivo),
            status: String(row.status ?? ""),
            nome_perfil_rf: toText(row.nome_perfil_rf),
            capacidade_max_equipamentos: capacityMax,
            perfil_rf: {
                nome: toText(row.nome_perfil_rf),
                modelo_gateway: toText(row.modelo_gateway),
                frequencia_mhz: toNumber(row.frequencia_mhz),
                potencia_transmissao_dbm: toNumber(row.potencia_transmissao_dbm),
                sensibilidade_recepcao_dbm: toNumber(row.sensibilidade_recepcao_dbm),
                alcance_estimado_m: toNumber(row.alcance_estimado_m),
                altura_gateway_m: toNumber(row.altura_gateway_m),
                altura_dispositivo_m: toNumber(row.altura_dispositivo_m),
                capacidade_max_equipamentos: capacityMax,
                quantidade_canais: toNumber(row.quantidade_canais),
                custo_estimado_gateway: toNumber(row.custo_estimado_gateway),
            },
            criterio: toText(row.nome_criterio_instalacao) ? {
                nome: toText(row.nome_criterio_instalacao),
                distancia_minima_ativos_m: toNumber(row.distancia_minima_ativos_m),
                distancia_maxima_ativos_m: toNumber(row.distancia_maxima_ativos_m),
                altura_minima_m: toNumber(row.altura_minima_m),
                limite_gateways: toNumber(row.limite_gateways),
                custo_maximo: toNumber(row.custo_maximo),
            } : null,
            imagem_mapa: meta.imagem,
            executado_em: toDate(row.executado_em),
            indicadores: {
                quantidade_gateways: toNumber(row.quantidade_gateways) ?? gateways.length,
                pontos_interesse: interestCount,
                pontos_cobertos: coveredCount,
                pontos_nao_cobertos: notCoveredCount,
                percentual_cobertura: toNumber(row.percentual_cobertura)
                    ?? (interestCount > 0 ? round((coveredCount / interestCount) * 100) : 0),
                capacidade_utilizada_media_pct: storedAverage !== null
                    ? round(storedAverage)
                    : gatewayCapacities.length > 0
                        ? round(gatewayCapacities.reduce((sum, value) => sum + value, 0) / gatewayCapacities.length)
                        : null,
                custo_total_estimado: toNumber(row.custo_total_estimado),
            },
            por_categoria: [...categories.values()].sort((a, b) => b.total - a.total),
            gateways,
            ativos_atendidos: [...covered.values()],
            ativos_nao_atendidos: notCovered,
        };
    }
}
