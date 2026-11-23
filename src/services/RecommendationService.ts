import { GatewayMetadataService } from "./GatewayMetadataService.js";

import { pool } from "../database/pool.js";

import type { EstudoPonto } from "../interface/estudo-ponto.js";

import type { PerfilRf } from "../interface/perfil-rf.js";

import type { Cenario } from "../interface/cenario.js";

import type { Coverage } from "../interface/PropagationDTO.js";

import { RecommendationUtils, type AtendimentoCalculado, type ResultadoCalculo } from "../utils/RecommendationUtils.js";

import { PropagationService } from "./PropagationService.js";

import { ScenarioService } from "./ScenarioService.js";

import type { BuildingsAround } from "./BuildingService.js";

import { EnvironmentalService } from "./EnvironmentalService.js";

import { StudyAssetPreparationService } from "./StudyAssetPreparationService.js";



export interface GerarRecomendacaoInput {

  id_usuario: number;

  id_estudo: number;

  id_perfil_rf: number;

  id_criterio_instalacao?: number | null;

  nome_cenario?: string;

}



interface RecommendationCriterion {

  tipos_elementos_permitidos?: unknown;

  tipos_elementos_proibidos?: unknown;

  distancia_minima_ativos_m?: number | string | null;

  distancia_maxima_ativos_m?: number | string | null;

  limite_gateways?: number | string | null;

  custo_maximo?: number | string | null;

  relevo?: unknown;

}



type EnvironmentalCriterion = Parameters<
  Awaited<ReturnType<EnvironmentalService["prepare"]>>["checkCandidate"]
>[1];

export class RecommendationService {

  private recommendationUtils: RecommendationUtils;

  private propagationService: PropagationService;

  private scenarioService: ScenarioService;

  private environmentalService: EnvironmentalService;



  constructor() {

    this.recommendationUtils = new RecommendationUtils();

    this.propagationService = new PropagationService();

    this.scenarioService = new ScenarioService();

    this.environmentalService = new EnvironmentalService();

  }



  async generateRecommendation(input: GerarRecomendacaoInput) {
    const { rows: studies } = await pool.query(
      "SELECT * FROM estudos WHERE id_estudo = $1 AND id_usuario = $2",
      [input.id_estudo, input.id_usuario],
    );
    const study = studies[0];
    if (!study) throw new Error("Estudo não encontrado.");

    const { rows: profiles } = await pool.query(
      "SELECT * FROM perfis_rf WHERE id_perfil_rf = $1 AND id_usuario = $2",
      [input.id_perfil_rf, input.id_usuario],
    );
    const profile = profiles[0] as PerfilRf | undefined;
    if (!profile) throw new Error("Perfil de RF não encontrado.");

    const criterionId = input.id_criterio_instalacao ??
      (study.id_criterio_instalacao == null ? null : Number(study.id_criterio_instalacao));
    let criterion: (RecommendationCriterion & NonNullable<EnvironmentalCriterion>) | null = null;
    if (criterionId != null) {
      const { rows } = await pool.query(
        "SELECT * FROM criterios_instalacao WHERE id_criterio_instalacao = $1 AND id_usuario = $2",
        [criterionId, input.id_usuario],
      );
      if (!rows[0]) throw new Error("Critério de instalação não encontrado.");
      criterion = rows[0] as RecommendationCriterion & NonNullable<EnvironmentalCriterion>;
    }

    // Prepara ativos antes de buscar os pontos; vértices da área não são ativos.
    await new StudyAssetPreparationService().prepare(input.id_estudo, criterionId);
    const { rows: points } = await pool.query(
      "SELECT * FROM estudo_pontos WHERE id_estudo = $1 AND COALESCE(atributos->>'tipo_ponto', '') <> 'vertice_area' ORDER BY id_estudo_ponto",
      [input.id_estudo],
    );
    const allPoints = (points as EstudoPonto[]).map(point => ({
      ...point, id_estudo_ponto: Number(point.id_estudo_ponto),
    }));
    const candidates = allPoints.filter(p => p.papel === "candidato" || p.papel === "ambos");
    const interestPoints = allPoints.filter(p => p.papel === "interesse" || p.papel === "ambos");
    if (!candidates.length) throw new Error("O estudo não possui pontos candidatos.");
    if (!interestPoints.length) throw new Error("O estudo não possui pontos de interesse.");

    const gatewayCost = Number(
      (profile as PerfilRf & { custo_estimado_gateway?: number | string | null }).custo_estimado_gateway ?? 0
    );
    let maxGateways = criterion?.limite_gateways == null
      ? Infinity : Number(criterion.limite_gateways);
    if (criterion?.custo_maximo != null && gatewayCost > 0) {
      maxGateways = Math.min(maxGateways, Math.floor(Number(criterion.custo_maximo) / gatewayCost));
    }

    const params = this.propagationService.buildParameters(profile);
    const environmental = await this.environmentalService.prepare(allPoints);
    const pointsById = new Map(interestPoints.map(p => [String(p.id_estudo_ponto), p]));
    const propagationPoints = interestPoints.map(p => ({
      id: String(p.id_estudo_ponto), latitude: Number(p.latitude), longitude: Number(p.longitude),
    }));
    const coverage = new Map<number, AtendimentoCalculado[]>();
    const buildingsByCandidate = new Map<number, BuildingsAround | null>();
    const eligibleCandidates: EstudoPonto[] = [];
    const siteBonuses = new Map<number, number>();
    let buildingsAvailable = 0;
    let buildingsMissing = 0;

    for (const candidate of candidates) {
      const gateway = { latitude: Number(candidate.latitude), longitude: Number(candidate.longitude) };
      const buildings = await this.propagationService.loadBuildings(params, gateway.latitude, gateway.longitude);
      buildingsByCandidate.set(candidate.id_estudo_ponto, buildings);
      if (buildings?.index) buildingsAvailable++;
      else buildingsMissing++;
      const decision = environmental.checkCandidate(candidate, criterion, interestPoints, buildings);
      if (!decision.eligible) {
        environmental.summary.candidatos_excluidos.push({
          id_estudo_ponto: candidate.id_estudo_ponto, motivos: decision.reasons,
        });
        continue;
      }
      eligibleCandidates.push(candidate);
      if (decision.bonus > 0) siteBonuses.set(candidate.id_estudo_ponto, decision.bonus);
      const links = await this.propagationService.calculateLinks(
        gateway, propagationPoints, params, buildings, environmental,
      );
      coverage.set(candidate.id_estudo_ponto, [...links.entries()]
        .filter(([, link]) => link.covered)
        .map(([id, link]) => ({
          ponto: pointsById.get(id)!, distanciaM: link.distanceM, nivelSinalDbm: link.signalDbm,
        })));
    }
    environmental.summary.fontes.edificacoes = buildingsAvailable
      ? (buildingsMissing ? "parcial" : "disponivel") : "indisponivel";
    if (!eligibleCandidates.length) {
      throw new Error("Nenhum candidato elegível após aplicar os critérios ambientais e de instalação.");
    }

    if (maxGateways <= 0) {
      throw new Error("O limite de gateways ou o custo máximo não permite instalar gateways.");
    }

    const result = this.recommendationUtils.CalculateRecommendation(
      eligibleCandidates, interestPoints, profile, coverage, siteBonuses, maxGateways,
    );
    const totalInterest = interestPoints.length;
    const totalCovered = totalInterest - result.pontosNaoCobertos.length;
    const totalCost = result.gateways.length * gatewayCost;
    const scenarioInput = {
      id_estudo: input.id_estudo,
      id_perfil_rf: input.id_perfil_rf,
      id_criterio_instalacao: criterionId,
      nome: input.nome_cenario ?? `Recomendação inicial - estudo ${input.id_estudo}`,
      status: "DEFINITIVO",
      quantidade_gateways: result.gateways.length,
      pontos_interesse: totalInterest,
      pontos_cobertos: totalCovered,
      pontos_nao_cobertos: result.pontosNaoCobertos.length,
      percentual_cobertura: totalInterest ? Math.round(totalCovered / totalInterest * 100) : 0,
      custo_total_estimado: totalCost,
      executado_em: new Date().toISOString(),
    };
    const scenario = await this.scenarioService.createScenario(scenarioInput);

    const coverageByGateway = new Map<number, Coverage>();
    const gatewayAttributes = new Map<number, Record<string, unknown>>();
    const metadata = new GatewayMetadataService();
    for (const gw of result.gateways) {
      const id = Number(gw.candidato.id_estudo_ponto);
      gatewayAttributes.set(id, await metadata.attributes(gw.candidato, study));
      const scenarioGateway = await this.scenarioService.createGatewayScenario({
        id_cenario: scenario.id_cenario,
        id_estudo_ponto: id,
        quantidade_pontos_atendidos: gw.atendimentos.length,
      });
      for (const at of gw.atendimentos) {
        await this.scenarioService.createServiceScenario({
          id_cenario_gateway: scenarioGateway.id_cenario_gateway,
          id_estudo_ponto: at.ponto.id_estudo_ponto,
          distancia_m: Math.round(at.distanciaM),
          nivel_sinal_estimado_dbm: Math.round(at.nivelSinalDbm * 10) / 10,
        });
      }
      const gatewayCoverage = await this.propagationService.buildCoverage(
        Number(gw.candidato.latitude), Number(gw.candidato.longitude), params, 120,
        buildingsByCandidate.get(id) ?? null, environmental,
      );
      await this.propagationService.saveGatewayCoverage(
        scenarioGateway.id_cenario_gateway, gatewayCoverage, params,
      );
      coverageByGateway.set(id, gatewayCoverage);
    }

    const formatted = this.formatResult(scenario as Cenario, result, interestPoints, coverageByGateway, totalCost);
    return {
      ...formatted,
      analise_ambiental: environmental.summary,
      gateways: formatted.gateways.map(gw => ({
        ...gw,
        atributos: gatewayAttributes.get(gw.id_estudo_ponto) ?? gw.atributos,
        alcance_medio_m: coverageByGateway.get(gw.id_estudo_ponto)?.mean_range_m ?? null,
        modelo_propagacao: coverageByGateway.get(gw.id_estudo_ponto)?.model ?? null,
        edificacoes_consideradas: coverageByGateway.get(gw.id_estudo_ponto)?.buildings_considered ?? false,
        quantidade_edificacoes: coverageByGateway.get(gw.id_estudo_ponto)?.buildings_count ?? 0,
      })),
    };
  }

  private formatResult(scenario: Cenario, result: ResultadoCalculo, interestPoints: EstudoPonto[], coverage: Map<number, Coverage>, totalCost: number) {

    const gatewayByPoint = new Map(result.gateways.flatMap((gateway) => gateway.atendimentos.map((attendance) => [Number(attendance.ponto.id_estudo_ponto), Number(gateway.candidato.id_estudo_ponto)] as const)));

    const categories = new Map<string, { tipo_ativo: string; total: number; nao_cobertos: number }>();

    for (const point of interestPoints) {

      const type = point.tipo_ativo ?? "desconhecido";

      const category = categories.get(type) ?? { tipo_ativo: type, total: 0, nao_cobertos: 0 };

      category.total++;

      if (!gatewayByPoint.has(Number(point.id_estudo_ponto))) category.nao_cobertos++;

      categories.set(type, category);

    }

    return {

      id_cenario: Number(scenario.id_cenario), nome: scenario.nome, objetivo: scenario.objetivo,

      otimizado: scenario.id_cenario_base == null, selecionado: scenario.status === "DEFINITIVO",

      quantidade_gateways: Number(scenario.quantidade_gateways), percentual_cobertura: Number(scenario.percentual_cobertura),

      custo_total_estimado: totalCost, pontos_interesse: Number(scenario.pontos_interesse),

      pontos_cobertos: Number(scenario.pontos_cobertos), pontos_nao_cobertos: Number(scenario.pontos_nao_cobertos),

      capacidade_utilizada_media_pct: scenario.capacidade_utilizada_media_pct != null ? Number(scenario.capacidade_utilizada_media_pct) : null,

      por_categoria: [...categories.values()].sort((first, second) => second.total - first.total),

      ativos_mapa: interestPoints.map((point) => ({

        id_estudo_ponto: Number(point.id_estudo_ponto), id_ativo_bdgd: point.id_ativo_bdgd, tipo_ativo: point.tipo_ativo,

        latitude: Number(point.latitude), longitude: Number(point.longitude),

        coberto: gatewayByPoint.has(Number(point.id_estudo_ponto)), id_gateway_referencia: gatewayByPoint.get(Number(point.id_estudo_ponto)) ?? null,

      })),

      gateways: result.gateways.map((gateway) => ({

        id_estudo_ponto: Number(gateway.candidato.id_estudo_ponto), id_ativo_bdgd: gateway.candidato.id_ativo_bdgd,

        rotulo: gateway.candidato.rotulo, latitude: Number(gateway.candidato.latitude), longitude: Number(gateway.candidato.longitude),

        quantidade_atendidos: gateway.atendimentos.length, atributos: gateway.candidato.atributos ?? {},

        mancha_cobertura: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.geometry ?? null,

        atendidos: gateway.atendimentos.map((attendance) => ({

          id_estudo_ponto: Number(attendance.ponto.id_estudo_ponto), tipo_ativo: attendance.ponto.tipo_ativo,

          distancia_m: Math.round(attendance.distanciaM), nivel_sinal_estimado_dbm: Math.round(attendance.nivelSinalDbm * 10) / 10,

        })),

      })),

    };

  }

}