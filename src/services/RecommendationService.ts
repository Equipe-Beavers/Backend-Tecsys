import { pool } from "../database/pool.js";
import type { EstudoPonto } from "../interface/estudo-ponto.js";
import type { PerfilRf } from "../interface/perfil-rf.js";
import type { Cenario } from "../interface/cenario.js";
import type { Coverage } from "../interface/PropagationDTO.js";
import { RecommendationUtils, type AtendimentoCalculado, type ResultadoCalculo } from "../utils/RecommendationUtils.js";
import { PropagationService } from "./PropagationService.js";
import { ScenarioService } from "./ScenarioService.js";
import type { BuildingsAround } from "./BuildingService.js";
import type { Coverage } from "../interface/PropagationDTO.js";
import type { InstallCriterionDTO } from "../interface/InstallCriterionDTO.js";
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
      "SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2",
      [input.id_estudo, input.id_usuario],
    );
    if (!studies[0]) throw new Error("Estudo não encontrado.");
    const { rows: profiles } = await pool.query(
      "SELECT * FROM perfis_rf WHERE id_perfil_rf = $1 AND id_usuario = $2",
      [input.id_perfil_rf, input.id_usuario],
    );
    const profile = profiles[0] as PerfilRf | undefined;
    if (!profile) throw new Error("Perfil de RF não encontrado.");
    const { rows: points } = await pool.query("SELECT * FROM estudo_pontos WHERE id_estudo = $1 ORDER BY id_estudo_ponto", [input.id_estudo]);
    const allPoints = (points as EstudoPonto[]).map((point) => ({ ...point, id_estudo_ponto: Number(point.id_estudo_ponto) }));
    const candidatePoints = allPoints.filter((point) => point.papel === "candidato" || point.papel === "ambos");
    const interestPoints = allPoints.filter((point) => point.papel === "interesse" || point.papel === "ambos");
    if (candidatePoints.length === 0) throw new Error("O estudo não possui pontos marcados como candidato ou ambos.");
    if (interestPoints.length === 0) throw new Error("O estudo não possui pontos marcados como interesse ou ambos.");

    // Os vertices do poligono definem a area, mas nao sao ativos BDGD.
    const preparation = await new StudyAssetPreparationService().prepare(
      input.id_estudo,
      input.id_criterio_instalacao ?? null,
    );
    const pointsResult = await pool.query(
      "SELECT * FROM estudo_pontos WHERE id_estudo = $1 AND COALESCE(atributos->>'tipo_ponto', '') <> 'vertice_area'",
      [input.id_estudo]
    );
    const points = pointsResult.rows;

    const allPoints = (points ?? []) as EstudoPonto[];
    const criterionId = input.id_criterio_instalacao ??
      (study.id_criterio_instalacao == null ? null : Number(study.id_criterio_instalacao));
    let criterion: InstallCriterionDTO | null = null;
    if (criterionId != null) {
      const selected = await pool.query(
        "SELECT * FROM criterios_instalacao WHERE id_criterio_instalacao = $1 AND id_usuario = (SELECT id_usuario FROM estudos WHERE id_estudo = $2)",
        [criterionId, input.id_estudo],
      );
      if (!selected.rows[0]) throw new Error("Critério de instalação não encontrado.");
      criterion = selected.rows[0] as InstallCriterionDTO;
    }
    const candidates = allPoints.filter(
      (p) => p.papel === "candidato" || p.papel === "ambos",
    );
    const interestPoints = allPoints.filter(
      (p) => p.papel === "interesse" || p.papel === "ambos",
    );

    if (candidates.length === 0)
      throw new Error(
        "O estudo não possui pontos marcados como candidato ou ambos.",
      );
    if (interestPoints.length === 0)
      throw new Error(
        "O estudo não possui nenhum ponto de interesse (papel interesse ou ambos).",
    let criterion: RecommendationCriterion | null = null;
    let maxGateways = Infinity;
    const gatewayCost = Number(profile.custo_estimado_gateway ?? 0);
    if (input.id_criterio_instalacao != null) {
      const { rows } = await pool.query(
        `SELECT tipos_elementos_permitidos, tipos_elementos_proibidos,
          distancia_minima_ativos_m, distancia_maxima_ativos_m, limite_gateways, custo_maximo, relevo
        FROM criterios_instalacao WHERE id_criterio_instalacao = $1 AND id_usuario = $2`,
        [input.id_criterio_instalacao, input.id_usuario],
      );
      if (!rows[0]) throw new Error("Critério de instalação não encontrado.");
      criterion = rows[0] as RecommendationCriterion;
      if (criterion.limite_gateways != null) maxGateways = Number(criterion.limite_gateways);
      if (criterion.custo_maximo != null && gatewayCost > 0) {
        maxGateways = Math.min(maxGateways, Math.floor(Number(criterion.custo_maximo) / gatewayCost));
      }
    }
    const candidates = candidatePoints.filter((candidate) => this.matchesCandidateCriterion(candidate, criterion));
    if (candidates.length === 0) throw new Error("Nenhum ponto candidato atende ao critério de instalação.");

    const params = this.propagationService.buildParameters(rf as PerfilRf);
    const environmental = await this.environmentalService.prepare(allPoints);
    const pointsById = new Map(interestPoints.map((p) => [String(p.id_estudo_ponto), p]));
    const propagationPoints = interestPoints.map((p) => ({
      id: String(p.id_estudo_ponto),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
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
          id_estudo_ponto: candidate.id_estudo_ponto,
          motivos: decision.reasons,
        });
        continue;
      }
      eligibleCandidates.push(candidate);
      if (decision.bonus > 0) siteBonuses.set(candidate.id_estudo_ponto, decision.bonus);

      const links = await this.propagationService.calculateLinks(gateway, propagationPoints, params, buildings, environmental);
      coverage.set(
        candidate.id_estudo_ponto,
        [...links.entries()]
          .filter(([, link]) => link.covered)
          .map(([id, link]) => ({
            ponto: pointsById.get(id)!,
            distanciaM: link.distanceM,
            nivelSinalDbm: link.signalDbm,
          })),
      );
    }
    environmental.summary.fontes.edificacoes = buildingsAvailable
      ? buildingsMissing ? "parcial" : "disponivel"
      : "indisponivel";
    if (!eligibleCandidates.length) {
      throw new Error("Nenhum candidato elegível após aplicar os critérios ambientais e de instalação.");
    }

    const result = this.recommendationUtils.CalculateRecommendation(
      eligibleCandidates,
      interestPoints,
      rf as PerfilRf,
      coverage,
      siteBonuses,
      criterion?.limite_gateways ?? Infinity,
    );

    const totalInterest = interestPoints.length;
    const totalCovered = totalInterest - result.pontosNaoCobertos.length;
    const gatewayCost = (rf as PerfilRf).custo_estimado_gateway ?? 0;
    const totalCost = result.gateways.length * gatewayCost;

    const scenario = await this.scenarioService.createScenario({
      id_estudo: input.id_estudo,
      id_perfil_rf: input.id_perfil_rf,
      id_criterio_instalacao: criterionId,
      nome:
        input.nome_cenario ??
        `Recomendação inicial - estudo ${input.id_estudo}`,
      status: "DEFINITIVO",
      quantidade_gateways: result.gateways.length,
      pontos_interesse: totalInterest,
      pontos_cobertos: totalCovered,
      pontos_nao_cobertos: result.pontosNaoCobertos.length,
      percentual_cobertura:
        totalInterest > 0
          ? Math.round((totalCovered / totalInterest) * 100)
          : 0,
      custo_total_estimado: totalCost,
      executado_em: new Date().toISOString(),
    });

  async selectRecommendation(studyId: number, scenarioId: number, userId: number) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const study = await client.query("SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2 FOR UPDATE", [studyId, userId]);
      if (!study.rows[0]) throw new Error("Estudo não encontrado.");
      const scenario = await client.query(`
        SELECT c.id_cenario FROM cenarios c JOIN estudos e ON e.id_estudo = c.id_estudo
        WHERE c.id_cenario = $1 AND c.id_estudo = $2 AND e.id_usuario = $3
          AND COALESCE(c.id_cenario_base, c.id_cenario) = (
            SELECT MAX(base.id_cenario) FROM cenarios base WHERE base.id_estudo = e.id_estudo
              AND base.id_cenario_base IS NULL AND base.id_perfil_rf = e.id_perfil_rf
              AND base.id_criterio_instalacao IS NOT DISTINCT FROM e.id_criterio_instalacao
          )`, [scenarioId, studyId, userId]);
      if (!scenario.rows[0]) throw new Error("Cenário não encontrado no grupo atual deste estudo.");
      await client.query("UPDATE cenarios SET status = 'RASCUNHO', atualizado_em = NOW() WHERE id_estudo = $1 AND status = 'DEFINITIVO'", [studyId]);
      await client.query("UPDATE cenarios SET status = 'DEFINITIVO', atualizado_em = NOW() WHERE id_cenario = $1 AND id_estudo = $2", [scenarioId, studyId]);
      await client.query("COMMIT");
      return { id_cenario_selecionado: scenarioId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private formatGroup(scenarios: ReturnType<RecommendationService["formatResult"]>[]) {
    return {
      ...scenarios[0], cenarios: scenarios,
      alternativas_geradas: scenarios.some((scenario) => scenario.objetivo === "Cobertura ponderada por prioridade"),
      id_cenario_selecionado: scenarios.find((scenario) => scenario.selecionado)?.id_cenario ?? null,
      aviso: scenarios.length > 0 && scenarios.length < 6
        ? `Foram encontradas ${scenarios.length} configurações distintas viáveis para os pontos e limites deste estudo.` : null,
    };
  }

  private matchesCandidateCriterion(candidate: EstudoPonto, criterion: RecommendationCriterion | null): boolean {
    if (!criterion) return true;
    const allowed = this.criterionTypes(criterion.tipos_elementos_permitidos);
    const blocked = this.criterionTypes(criterion.tipos_elementos_proibidos);
    const type = this.normalizeAssetType(candidate.tipo_ativo);
    if ((allowed.size > 0 && !allowed.has(type)) || blocked.has(type)) return false;

        const gatewayCoverage = await this.propagationService.buildCoverage(
          Number(gw.candidato.latitude),
          Number(gw.candidato.longitude),
          params,
          120, // mancha com amostragem ambiental; menos raios que o modo puramente geometrico
          buildingsByCandidate.get(gw.candidato.id_estudo_ponto) ?? null,
          environmental,
        );
        await this.propagationService.saveGatewayCoverage(scenarioGateway.id_cenario_gateway, gatewayCoverage, params);
        coverageByGateway.set(gw.candidato.id_estudo_ponto, gatewayCoverage);
      }
    }
    return true;
  }

  private matchesAssetDistance(distanceM: number, criterion: RecommendationCriterion | null): boolean {
    if (!criterion) return true;
    const minimum = this.optionalNumber(criterion.distancia_minima_ativos_m);
    const maximum = this.optionalNumber(criterion.distancia_maxima_ativos_m);
    return (minimum == null || distanceM >= minimum) && (maximum == null || distanceM <= maximum);
  }

  private criterionTypes(value: unknown): Set<string> {
    return new Set(Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").map((item) => this.normalizeAssetType(item))
      : []);
  }

  private normalizeAssetType(value: string | null | undefined): string {
    const key = (value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s-]+/g, "_");
    return ({ POSTES: "POSTE", SUBESTACOES: "SUBESTACAO" } as Record<string, string>)[key] ?? key;
  }

    const byCategory = [...totalByType.entries()].map(
      ([tipo, total]) => ({
        tipo_ativo: tipo,
        total,
        cobertos: total - (notCoveredByType.get(tipo) ?? 0),
        nao_cobertos: notCoveredByType.get(tipo) ?? 0,
      }),
    ).sort((a, b) => b.total - a.total);

      return {
        id_cenario: Number(scenario.id_cenario),
        quantidade_gateways: result.gateways.length,
        percentual_cobertura: Number(scenario.percentual_cobertura ?? 0),
        custo_total_estimado: totalCost,
        pontos_interesse: totalInterest,
        pontos_cobertos: totalCovered,
        pontos_nao_cobertos: result.pontosNaoCobertos.length,
        por_categoria: byCategory,
        analise_ambiental: environmental.summary,
        mancha_consolidada: consolidatedCoverage,
        ativos_mapa: interestPoints.map((point) => {
          const gateway = result.gateways.find((item) =>
            item.atendimentos.some(
              (attendance) =>
                attendance.ponto.id_estudo_ponto === point.id_estudo_ponto,
            ),
          );

          return {
            id_estudo_ponto: Number(point.id_estudo_ponto),
            id_ativo_bdgd: point.id_ativo_bdgd,
            tipo_ativo: point.tipo_ativo,
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            coberto: gateway !== undefined,
            id_gateway_referencia: gateway
              ? Number(gateway.candidato.id_estudo_ponto)
              : null,
          };
        }),
        gateways: result.gateways.map((gw) => ({
          id_estudo_ponto: Number(gw.candidato.id_estudo_ponto),
          id_ativo_bdgd: gw.candidato.id_ativo_bdgd,
          rotulo: gw.candidato.rotulo,
          latitude: Number(gw.candidato.latitude),
          longitude: Number(gw.candidato.longitude),
          quantidade_atendidos: gw.atendimentos.length,
          atributos: gw.candidato.atributos ?? {},
          mancha_cobertura: coverageByGateway.get(gw.candidato.id_estudo_ponto)?.geometry ?? null,
          alcance_medio_m: coverageByGateway.get(gw.candidato.id_estudo_ponto)?.mean_range_m ?? null,
          modelo_propagacao: coverageByGateway.get(gw.candidato.id_estudo_ponto)?.model ?? null,
          edificacoes_consideradas: coverageByGateway.get(gw.candidato.id_estudo_ponto)?.buildings_considered ?? false,
          quantidade_edificacoes: coverageByGateway.get(gw.candidato.id_estudo_ponto)?.buildings_count ?? 0,
          atendidos: gw.atendimentos.map((a) => ({
            id_estudo_ponto: Number(a.ponto.id_estudo_ponto),
            tipo_ativo: a.ponto.tipo_ativo,
            distancia_m: Math.round(a.distanciaM),
            nivel_sinal_estimado_dbm: Math.round(a.nivelSinalDbm * 10)/10,
          }))
        }))
      }
  }

  private formatResult(scenario: Cenario, result: ResultadoCalculo, interestPoints: EstudoPonto[], coverage: Map<number, Coverage>) {
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
      custo_total_estimado: Number(scenario.custo_total_estimado), pontos_interesse: Number(scenario.pontos_interesse),
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