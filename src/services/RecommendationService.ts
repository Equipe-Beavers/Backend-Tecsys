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


  private environmentalService: EnvironmentalService;



  constructor() {

    this.recommendationUtils = new RecommendationUtils();

    this.propagationService = new PropagationService();


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
      coverage.set(
        candidate.id_estudo_ponto,
        [...links.entries()]
          .filter(([, link]) => link.covered)
          .map(([id, link]) => ({
            ponto: pointsById.get(id)!,
            distanciaM: link.distanceM,
            nivelSinalDbm: link.signalDbm,
          }))
      );
    }
    environmental.summary.fontes.edificacoes = buildingsAvailable
      ? (buildingsMissing ? "parcial" : "disponivel") : "indisponivel";
    if (!eligibleCandidates.length) {
      throw new Error("Nenhum candidato elegível após aplicar os critérios ambientais e de instalação.");
    }

    if (maxGateways <= 0) {
      throw new Error("O limite de gateways ou o custo máximo não permite instalar gateways.");
    }

    const results = this.recommendationUtils.CalculateAlternatives(
      eligibleCandidates, interestPoints, profile, coverage, maxGateways, 6, siteBonuses,
    );
    if (!results[0]?.gateways.length) throw new Error("Não existe implantação viável para os pontos e limites informados.");
    const coverageByGateway = new Map<number, Coverage>();
    const gatewayAttributes = new Map<number, Record<string, unknown>>();
    const metadata = new GatewayMetadataService();
    for (const result of results) {
      for (const gateway of result.gateways) {
        const id = Number(gateway.candidato.id_estudo_ponto);
        if (!gatewayAttributes.has(id)) {
          gatewayAttributes.set(id, await metadata.attributes(gateway.candidato, study));
        }
        gateway.candidato = { ...gateway.candidato, atributos: gatewayAttributes.get(id)! };
        if (coverageByGateway.has(id)) continue;
        coverageByGateway.set(id, await this.propagationService.buildCoverage(
          Number(gateway.candidato.latitude), Number(gateway.candidato.longitude), params, 120,
          buildingsByCandidate.get(id) ?? null, environmental,
        ));
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lockedStudy = await client.query("SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2 FOR UPDATE", [input.id_estudo, input.id_usuario]);
      if (!lockedStudy.rows[0]) throw new Error("Estudo não encontrado.");
      const scenarioService = new ScenarioService(client);
      const scenarios: (ReturnType<RecommendationService["formatResult"]> & { analise_ambiental?: unknown })[] = [];
      let baseId: number | null = null;
      for (const [index, result] of results.entries()) {
        const totalCovered = interestPoints.length - result.pontosNaoCobertos.length;
        const capacity = profile.capacidade_max_equipamentos != null ? Number(profile.capacidade_max_equipamentos) : null;
        const scenario = await scenarioService.createScenario({
          id_estudo: input.id_estudo, id_perfil_rf: input.id_perfil_rf,
          id_criterio_instalacao: criterionId, id_cenario_base: baseId,
          nome: index === 0 ? (input.nome_cenario ?? "Otimizada") : `Alternativa ${index}`,
          objetivo: index === 0 ? "Cobertura ponderada por prioridade" : "Implantação distinta ordenada por prioridade e cobertura",
          status: "RASCUNHO", quantidade_gateways: result.gateways.length,
          pontos_interesse: interestPoints.length, pontos_cobertos: totalCovered,
          pontos_nao_cobertos: result.pontosNaoCobertos.length,
          percentual_cobertura: Math.round(totalCovered / interestPoints.length * 100),
          capacidade_utilizada_media_pct: capacity && result.gateways.length ? Math.round(totalCovered / (result.gateways.length * capacity) * 10000) / 100 : null,
          executado_em: new Date().toISOString(),
        });
        if (baseId === null) baseId = Number(scenario.id_cenario);
        for (const [order, gateway] of result.gateways.entries()) {
          const savedGateway = await scenarioService.createGatewayScenario({
            id_cenario: scenario.id_cenario, id_estudo_ponto: gateway.candidato.id_estudo_ponto,
            ordem: order + 1, quantidade_pontos_atendidos: gateway.atendimentos.length,
            capacidade_utilizada_pct: capacity ? gateway.atendimentos.length / capacity * 100 : null,
          });
          for (const attendance of gateway.atendimentos) {
            await scenarioService.createServiceScenario({
              id_cenario_gateway: savedGateway.id_cenario_gateway, id_estudo_ponto: attendance.ponto.id_estudo_ponto,
              distancia_m: Math.round(attendance.distanciaM), nivel_sinal_estimado_dbm: Math.round(attendance.nivelSinalDbm * 10) / 10,
            });
          }
          await this.propagationService.saveGatewayCoverage(savedGateway.id_cenario_gateway, coverageByGateway.get(gateway.candidato.id_estudo_ponto)!, params, client, {
            candidato_snapshot: { ...gateway.candidato, atributos: gatewayAttributes.get(gateway.candidato.id_estudo_ponto) ?? gateway.candidato.atributos },
            custo_total_estimado: result.gateways.length * gatewayCost,
            analise_ambiental: environmental.summary,
            quantidade_edificacoes: coverageByGateway.get(gateway.candidato.id_estudo_ponto)?.buildings_count ?? 0,
            ...(order === 0 ? { pontos_interesse_snapshot: interestPoints } : {}),
          });
        }
        await this.propagationService.saveScenarioCoverage(Number(scenario.id_cenario), client);
        scenarios.push({ ...this.formatResult(scenario, result, interestPoints, coverageByGateway, result.gateways.length * gatewayCost), analise_ambiental: environmental.summary });
      }
      await client.query("COMMIT");
      return { ...this.formatGroup(scenarios), analise_ambiental: environmental.summary };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRecommendations(studyId: number, userId: number) {
    const { rows } = await pool.query(`
      SELECT c.* FROM cenarios c JOIN estudos e ON e.id_estudo = c.id_estudo
      WHERE c.id_estudo = $1 AND e.id_usuario = $2 AND c.executado_em IS NOT NULL AND
        COALESCE(c.id_cenario_base, c.id_cenario) = (
          SELECT MAX(base.id_cenario) FROM cenarios base
          WHERE base.id_estudo = c.id_estudo AND base.id_cenario_base IS NULL
          AND base.executado_em IS NOT NULL AND base.id_perfil_rf = e.id_perfil_rf
          AND base.id_criterio_instalacao IS NOT DISTINCT FROM e.id_criterio_instalacao
        )
      ORDER BY c.id_cenario_base NULLS FIRST, c.id_cenario`, [studyId, userId]);
    const scenarios: (ReturnType<RecommendationService["formatResult"]> & { analise_ambiental?: unknown })[] = [];
    for (const scenario of rows as Cenario[]) {
      const { rows: gateways } = await pool.query(`
        SELECT cg.*, to_jsonb(p) AS candidato, ST_AsGeoJSON(cg.mancha_cobertura)::json AS geometry
        FROM cenario_gateways cg JOIN estudo_pontos p ON p.id_estudo_ponto = cg.id_estudo_ponto
        WHERE cg.id_cenario = $1 ORDER BY cg.ordem NULLS LAST, cg.id_cenario_gateway`, [scenario.id_cenario]);
      const snapshot = gateways[0]?.parametros_calculo?.pontos_interesse_snapshot as EstudoPonto[] | undefined;
      const interestPoints = snapshot ?? (await pool.query(
        "SELECT * FROM estudo_pontos WHERE id_estudo = $1 AND papel IN ('interesse', 'ambos') AND COALESCE(atributos->>'tipo_ponto', '') <> 'vertice_area' ORDER BY id_estudo_ponto", [studyId],
      )).rows as EstudoPonto[];
      const { rows: attendances } = await pool.query(`
        SELECT a.* FROM cenario_atendimentos a JOIN cenario_gateways cg USING (id_cenario_gateway)
        WHERE cg.id_cenario = $1 ORDER BY a.id_atendimento`, [scenario.id_cenario]);
      const pointsById = new Map(interestPoints.map((point) => [Number(point.id_estudo_ponto), point]));
      const covered = new Set(attendances.map((attendance) => Number(attendance.id_estudo_ponto)));
      const result: ResultadoCalculo = {
        gateways: gateways.map((gateway) => ({
          candidato: gateway.parametros_calculo?.candidato_snapshot ?? gateway.candidato,
          atendimentos: attendances.filter((attendance) => Number(attendance.id_cenario_gateway) === Number(gateway.id_cenario_gateway))
            .filter((attendance) => pointsById.has(Number(attendance.id_estudo_ponto)))
            .map((attendance) => ({ ponto: pointsById.get(Number(attendance.id_estudo_ponto))!, distanciaM: Number(attendance.distancia_m), nivelSinalDbm: Number(attendance.nivel_sinal_estimado_dbm) })),
        })),
        pontosNaoCobertos: interestPoints.filter((point) => !covered.has(Number(point.id_estudo_ponto))),
      };
      const coverageByGateway = new Map(gateways.map((gateway) => [Number(gateway.id_estudo_ponto), {
        geometry: gateway.geometry,
        mean_range_m: gateway.parametros_calculo?.alcance_medio_m,
        model: gateway.parametros_calculo?.modelo,
        buildings_considered: gateway.parametros_calculo?.edificacoes_consideradas,
        buildings_count: gateway.parametros_calculo?.quantidade_edificacoes,
      } as Coverage]));
      scenarios.push({
        ...this.formatResult(scenario, result, interestPoints, coverageByGateway, Number(gateways[0]?.parametros_calculo?.custo_total_estimado ?? 0)),
        analise_ambiental: gateways[0]?.parametros_calculo?.analise_ambiental,
      });
    }
    return this.formatGroup(scenarios);
  }

  async selectRecommendation(studyId: number, scenarioId: number, userId: number) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const study = await client.query("SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2 FOR UPDATE", [studyId, userId]);
      if (!study.rows[0]) throw new Error("Estudo não encontrado.");
      const scenario = await client.query(`
        SELECT c.id_cenario FROM cenarios c JOIN estudos e ON e.id_estudo = c.id_estudo
        WHERE c.id_cenario = $1 AND c.id_estudo = $2 AND e.id_usuario = $3 AND c.executado_em IS NOT NULL
          AND COALESCE(c.id_cenario_base, c.id_cenario) = (
            SELECT MAX(base.id_cenario) FROM cenarios base WHERE base.id_estudo = e.id_estudo
              AND base.id_cenario_base IS NULL AND base.executado_em IS NOT NULL AND base.id_perfil_rf = e.id_perfil_rf
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
      alternativas_geradas: scenarios.length > 0,
      id_cenario_selecionado: scenarios.find((scenario) => scenario.selecionado)?.id_cenario ?? null,
      aviso: scenarios.length > 0 && scenarios.length < 6
        ? `Foram encontradas ${scenarios.length} configurações distintas viáveis para os pontos e limites deste estudo.` : null,
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

        alcance_medio_m: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.mean_range_m ?? null,
        modelo_propagacao: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.model ?? null,
        edificacoes_consideradas: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.buildings_considered ?? false,
        quantidade_edificacoes: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.buildings_count ?? 0,

        mancha_cobertura: coverage.get(Number(gateway.candidato.id_estudo_ponto))?.geometry ?? null,

        atendidos: gateway.atendimentos.map((attendance) => ({

          id_estudo_ponto: Number(attendance.ponto.id_estudo_ponto), tipo_ativo: attendance.ponto.tipo_ativo,
          atributos: { ...attendance.ponto.atributos, latitude: Number(attendance.ponto.latitude), longitude: Number(attendance.ponto.longitude) },

          distancia_m: Math.round(attendance.distanciaM), nivel_sinal_estimado_dbm: Math.round(attendance.nivelSinalDbm * 10) / 10,

        })),

      })),

    };

  }

}
