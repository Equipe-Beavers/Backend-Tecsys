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
        const mapImage = decodeMapImage(options.imagem_mapa);
        const studyResult = await pool.query(findExportStudyQuery, [idStudy, userId]);
        const studyRow = studyResult.rows[0] as Row | undefined;
        if (!studyRow) throw new StudyError(404, "Estudo não encontrado.");

        const scenariosResult = await pool.query(findExportScenariosQuery, [idStudy]);
        const scenarioRows = scenariosResult.rows as Row[];
        if (scenarioRows.length === 0) {
            throw new StudyError(409, "O estudo ainda não possui resultados processados para exportar.");
        }

        let finalRow: Row | undefined;
        if (options.id_cenario !== undefined) {
            finalRow = scenarioRows.find((row) => Number(row.id_cenario) === Number(options.id_cenario));
            if (!finalRow) throw new StudyError(404, "Cenário processado não encontrado neste estudo.");
        } else {
            finalRow = scenarioRows[scenarioRows.length - 1];
        }
        if (!finalRow) throw new StudyError(409, "O estudo ainda não possui resultados processados para exportar.");

        const alternativeRows = options.incluir_alternativas
            ? scenarioRows.filter((row) => row !== finalRow)
            : [];
        const selectedRows = [finalRow, ...alternativeRows];
        const scenarioIds = selectedRows.map((row) => Number(row.id_cenario));

        const [gatewaysResult, servicesResult, interestResult] = await Promise.all([
            pool.query(findExportGatewaysQuery, [scenarioIds]),
            pool.query(findExportServicesQuery, [scenarioIds]),
            pool.query(findExportInterestPointsQuery, [idStudy]),
        ]);
        const interestPoints = (interestResult.rows as Row[]).map(mapAsset);

        const scenarios = selectedRows.map((row) => this.buildScenario(
            row,
            (gatewaysResult.rows as Row[]).filter((item) => Number(item.id_cenario) === Number(row.id_cenario)),
            (servicesResult.rows as Row[]).filter((item) => Number(item.id_cenario) === Number(row.id_cenario)),
            interestPoints,
            row === finalRow,
        ));

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

        const [cenarioFinal, ...alternativas] = scenarios;
        return { gerado_em: new Date(), estudo, imagem_mapa: mapImage, cenario_final: cenarioFinal!, alternativas };
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
        isFinal: boolean,
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
            descricao: toText(row.descricao),
            status: String(row.status ?? ""),
            nome_perfil_rf: toText(row.nome_perfil_rf),
            capacidade_max_equipamentos: capacityMax,
            executado_em: toDate(row.executado_em),
            final: isFinal,
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
