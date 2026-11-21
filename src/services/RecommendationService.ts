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
  private recommendationUtils = new RecommendationUtils();
  private propagationService = new PropagationService();

  async generateRecommendation(input: GerarRecomendacaoInput) {
    const studyResult = await pool.query(
      "SELECT id_estudo, municipio, bairro, uf FROM estudos WHERE id_estudo = $1 AND id_usuario = $2",
      [input.id_estudo, input.id_usuario]
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

    const params = this.propagationService.buildParameters(profile);
    const pointsById = new Map(interestPoints.map((point) => [String(point.id_estudo_ponto), point]));
    const propagationPoints = interestPoints.map((point) => ({
      id: String(point.id_estudo_ponto), latitude: Number(point.latitude), longitude: Number(point.longitude),
    }));
    const coverage = new Map<number, AtendimentoCalculado[]>();
    const coverageByGateway = new Map<number, Coverage>();
    const buildingsByGateway = new Map<number, BuildingsAround | null>();
    for (const candidate of candidates) {
      const gateway = { latitude: Number(candidate.latitude), longitude: Number(candidate.longitude) };
      const buildings = await this.propagationService.loadBuildings(params, gateway.latitude, gateway.longitude);
      buildingsByGateway.set(candidate.id_estudo_ponto, buildings);
      const links = await this.propagationService.calculateLinks(gateway, propagationPoints, params, buildings);
      coverage.set(candidate.id_estudo_ponto, [...links.entries()]
        .filter(([, link]) => link.covered)
        .filter(([, link]) => this.matchesAssetDistance(link.distanceM, criterion))
        .map(([id, link]) => ({ ponto: pointsById.get(id)!, distanciaM: link.distanceM, nivelSinalDbm: link.signalDbm })));
    }
    const results = this.recommendationUtils.CalculateAlternatives(candidates, interestPoints, profile, coverage, maxGateways);
    if (!results[0]?.gateways.length) throw new Error("Não existe implantação viável para os pontos e limites informados.");
    for (const result of results) {
      for (const gateway of result.gateways) {
        if (coverageByGateway.has(gateway.candidato.id_estudo_ponto)) continue;
        coverageByGateway.set(gateway.candidato.id_estudo_ponto, await this.propagationService.buildCoverage(
          Number(gateway.candidato.latitude), Number(gateway.candidato.longitude), params, undefined,
          buildingsByGateway.get(gateway.candidato.id_estudo_ponto),
        ));
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2 FOR UPDATE", [input.id_estudo, input.id_usuario]);
      const scenarioService = new ScenarioService(client);
      const scenarios: ReturnType<RecommendationService["formatResult"]>[] = [];
      let baseId: number | null = null;
      for (const [index, result] of results.entries()) {
        const totalCovered = interestPoints.length - result.pontosNaoCobertos.length;
        const capacity = profile.capacidade_max_equipamentos != null ? Number(profile.capacidade_max_equipamentos) : null;
        const scenario = await scenarioService.createScenario({
          id_estudo: input.id_estudo, id_perfil_rf: input.id_perfil_rf,
          id_criterio_instalacao: input.id_criterio_instalacao ?? null, id_cenario_base: baseId,
          nome: index === 0 ? (input.nome_cenario ?? "Otimizada") : `Alternativa ${index}`,
          objetivo: index === 0 ? "Cobertura ponderada por prioridade" : "Implantação distinta ordenada por prioridade e cobertura",
          status: "RASCUNHO", quantidade_gateways: result.gateways.length,
          pontos_interesse: interestPoints.length, pontos_cobertos: totalCovered,
          pontos_nao_cobertos: result.pontosNaoCobertos.length,
          percentual_cobertura: Math.round(totalCovered / interestPoints.length * 100),
          capacidade_utilizada_media_pct: capacity && result.gateways.length ? Math.round(totalCovered / (result.gateways.length * capacity) * 10000) / 100 : null,
          custo_total_estimado: result.gateways.length * gatewayCost, executado_em: new Date().toISOString(),
        });
        if (baseId === null) baseId = Number(scenario.id_cenario);
        for (const [order, gateway] of result.gateways.entries()) {
          const savedGateway = await scenarioService.createGatewayScenario({
            id_cenario: scenario.id_cenario, id_estudo_ponto: gateway.candidato.id_estudo_ponto,
            ordem: order + 1, quantidade_pontos_atendidos: gateway.atendimentos.length,
            capacidade_utilizada_pct: capacity ? gateway.atendimentos.length / capacity * 100 : null,
            custo_estimado: gatewayCost,
          });
          for (const attendance of gateway.atendimentos) {
            await scenarioService.createServiceScenario({
              id_cenario_gateway: savedGateway.id_cenario_gateway, id_estudo_ponto: attendance.ponto.id_estudo_ponto,
              distancia_m: Math.round(attendance.distanciaM), nivel_sinal_estimado_dbm: Math.round(attendance.nivelSinalDbm * 10) / 10,
            });
          }
          await this.propagationService.saveGatewayCoverage(savedGateway.id_cenario_gateway, coverageByGateway.get(gateway.candidato.id_estudo_ponto)!, params, client, {
            candidato_snapshot: gateway.candidato,
            ...(order === 0 ? { pontos_interesse_snapshot: interestPoints } : {}),
          });
        }
        await this.propagationService.saveScenarioCoverage(Number(scenario.id_cenario), client);
        scenarios.push(this.formatResult(scenario, result, interestPoints, coverageByGateway));
      }
      await client.query("COMMIT");
      return this.formatGroup(scenarios);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

    const totalInterest = interestPoints.length;
    const totalCovered = totalInterest - result.pontosNaoCobertos.length;

    const scenario = await this.scenarioService.createScenario({
      id_estudo: input.id_estudo,
      id_perfil_rf: input.id_perfil_rf,
      id_criterio_instalacao: input.id_criterio_instalacao ?? null,
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
      executado_em: new Date().toISOString(),
    });

    const coverageByGateway = new Map<number, Coverage>();
    const gatewayAttributes = new Map<number, Record<string, unknown>>();
    const metadata = new GatewayMetadataService();
    for (const gateway of result.gateways) {
      gatewayAttributes.set(gateway.candidato.id_estudo_ponto,
        await metadata.attributes(gateway.candidato, study));
    }


    for (const gw of result.gateways) {
      const scenarioGateway = await this.scenarioService.createGatewayScenario({
        id_cenario: scenario.id_cenario,
        id_estudo_ponto: gw.candidato.id_estudo_ponto,
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

    const relief = criterion.relevo;
    if (relief && typeof relief === "object" && !Array.isArray(relief)) {
      const values = relief as Record<string, unknown>;
      const minimum = this.optionalNumber(values.altitude_minima_m);
      const maximum = this.optionalNumber(values.altitude_maxima_m);
      if (minimum != null || maximum != null) {
        const elevation = this.optionalNumber(candidate.relevo_m);
        if (elevation == null || (minimum != null && elevation < minimum) || (maximum != null && elevation > maximum)) {
          return false;
        }
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
        nao_cobertos: notCoveredByType.get(tipo) ?? 0,
      }),
    ).sort((a, b) => b.total - a.total);

      return {
        id_cenario: Number(scenario.id_cenario),
        quantidade_gateways: result.gateways.length,
        percentual_cobertura: Number(scenario.percentual_cobertura ?? 0),
        pontos_interesse: totalInterest,
        pontos_cobertos: totalCovered,
        pontos_nao_cobertos: result.pontosNaoCobertos.length,
        por_categoria: byCategory,
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
          atributos: gatewayAttributes.get(gw.candidato.id_estudo_ponto) ?? {},
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