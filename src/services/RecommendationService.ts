import { pool } from "../database/pool.js";
import type { EstudoPonto } from "../interface/estudo-ponto.js";
import type { PerfilRf } from "../interface/perfil-rf.js";
import { RecommendationUtils } from "../utils/RecommendationUtils.js";

export interface GerarRecomendacaoInput {
  id_estudo: number;
  id_perfil_rf: number;
  id_criterio_instalacao?: number | null;
  nome_cenario?: string;
}

export class RecommendationService {
  private recommendationUtils: RecommendationUtils;

  constructor() {
    this.recommendationUtils = new RecommendationUtils();
  }

  async generateRecommendation(input: GerarRecomendacaoInput) {
    const studyResult = await pool.query(
      "SELECT id_estudo FROM estudos WHERE id_estudo = $1",
      [input.id_estudo]
    );
    const study = studyResult.rows[0];
    if (!study) throw new Error("Estudo não encontrado.");

    const rfResult = await pool.query(
      "SELECT * FROM perfis_rf WHERE id_perfil_rf = $1",
      [input.id_perfil_rf]
    );
    const rf = rfResult.rows[0];
    if (!rf) throw new Error("Perfil de RF não encontrado.");

    const pointsResult = await pool.query(
      "SELECT * FROM estudo_pontos WHERE id_estudo = $1",
      [input.id_estudo]
    );
    const points = pointsResult.rows;

    const allPoints = (points ?? []) as EstudoPonto[];
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
      );

    const result = this.recommendationUtils.CalculateRecommendation(
      candidates,
      interestPoints,
      rf as PerfilRf,
    );

    const totalInterest = interestPoints.length;
    const totalCovered = totalInterest - result.pontosNaoCobertos.length;
    const gatewayCost = (rf as PerfilRf).custo_estimado_gateway ?? 0;
    const totalCost = result.gateways.length * gatewayCost;

    const scenarioQuery = `
      INSERT INTO cenarios 
      (id_estudo, id_perfil_rf, id_criterio_instalacao, nome, status, quantidade_gateways, pontos_interesse, pontos_cobertos, pontos_nao_cobertos, percentual_cobertura, custo_total_estimado, executado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const scenarioValues = [
      input.id_estudo,
      input.id_perfil_rf,
      input.id_criterio_instalacao ?? null,
      input.nome_cenario ?? `Recomendação inicial - estudo ${input.id_estudo}`,
      "DEFINITIVO",
      result.gateways.length,
      totalInterest,
      totalCovered,
      result.pontosNaoCobertos.length,
      totalInterest > 0 ? Math.round((totalCovered / totalInterest) * 100) : 0,
      totalCost,
      new Date().toISOString(),
    ];

    const scenarioResult = await pool.query(scenarioQuery, scenarioValues);
    const scenario = scenarioResult.rows[0];
    if (!scenario) throw new Error("Erro ao criar cenário.");

    for (const gw of result.gateways) {
      const gtwQuery = `
        INSERT INTO cenario_gateways 
        (id_cenario, id_estudo_ponto, quantidade_pontos_atendidos, custo_estimado)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const gtwValues = [
        scenario.id_cenario,
        gw.candidato.id_estudo_ponto,
        gw.atendimentos.length,
        gatewayCost,
      ];

      const gtwResult = await pool.query(gtwQuery, gtwValues);
      const scenarioGateway = gtwResult.rows[0];
      if (!scenarioGateway) throw new Error("Erro ao criar gateway do cenário.");

      for (const at of gw.atendimentos) {
        const atQuery = `
          INSERT INTO cenario_atendimentos 
          (id_cenario_gateway, id_estudo_ponto, distancia_m, nivel_sinal_estimado_dbm)
          VALUES ($1, $2, $3, $4);
        `;
        const atValues = [
          scenarioGateway.id_cenario_gateway,
          at.ponto.id_estudo_ponto,
          Math.round(at.distanciaM),
          Math.round(at.nivelSinalDbm * 10) / 10,
        ];

        await pool.query(atQuery, atValues);
      }
    }

    const notCoveredByType = new Map<string, number>();
    for (const point of result.pontosNaoCobertos) {
      const tipo = point.tipo_ativo ?? "desconhecido";
      notCoveredByType.set(tipo, (notCoveredByType.get(tipo) ?? 0) + 1);
    }

    const totalByType = new Map<string, number>();
    for (const point of interestPoints) {
      const tipo = point.tipo_ativo ?? "desconhecido";
      totalByType.set(tipo, (totalByType.get(tipo) ?? 0) + 1);
    }

    const byCategory = [...totalByType.entries()].map(
      ([tipo, total]) => ({
        tipo_ativo: tipo,
        total,
        nao_cobertos: notCoveredByType.get(tipo) ?? 0,
      }),
    ).sort((a, b) => b.total - a.total);

    return {
      id_cenario: scenario.id_cenario,
      quantidade_gateways: result.gateways.length,
      percentual_cobertura: scenario.percentual_cobertura,
      custo_total_estimado: totalCost,
      pontos_interesse: totalInterest,
      pontos_cobertos: totalCovered,
      pontos_nao_cobertos: result.pontosNaoCobertos.length,
      por_categoria: byCategory,
      gateways: result.gateways.map((gw) => ({
        id_estudo_ponto: gw.candidato.id_estudo_ponto,
        id_ativo_bdgd: gw.candidato.id_ativo_bdgd,
        rotulo: gw.candidato.rotulo,
        latitude: gw.candidato.latitude,
        longitude: gw.candidato.longitude,
        quantidade_atendidos: gw.atendimentos.length,
        atributos: gw.candidato.atributos ?? {},
        atendidos: gw.atendimentos.map((a) => ({
          id_estudo_ponto: a.ponto.id_estudo_ponto,
          tipo_ativo: a.ponto.tipo_ativo,
          distancia_m: Math.round(a.distanciaM),
          nivel_sinal_estimado_dbm: Math.round(a.nivelSinalDbm * 10) / 10,
        })),
      })),
    };
  }
}