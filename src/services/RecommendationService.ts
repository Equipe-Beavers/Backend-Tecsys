import { supabase } from "../database/supabase.js";
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
    const { data: study, error: sError } = await supabase
      .from("estudos")
      .select("id_estudo")
      .eq("id_estudo", input.id_estudo)
      .maybeSingle();
    if (sError) throw new Error(`Erro ao consultar estudo: ${sError.message}`);
    if (!study) throw new Error(`Estudo não encontrado.`);

    const { data: rf, error: rfError } = await supabase
      .from("perfis_rf")
      .select("*")
      .eq("id_perfil_rf", input.id_perfil_rf)
      .maybeSingle();
    if (rfError)
      throw new Error(`Erro ao consultar perfil de RF: ${rfError.message}.`);
    if (!rf) throw new Error(`Perfil de RF não encontrado.`);

    const { data: points, error: pError } = await supabase
      .from("estudo_pontos")
      .select("*")
      .eq("id_estudo", input.id_estudo);
    if (pError)
      throw new Error(`Erro ao consultar pontos de estudo: ${pError.message}`);

    const allPoints = (points ?? []) as EstudoPonto[];
    const candidates = allPoints.filter(
      (p) => p.papel === "candidato" || p.papel === "ambos",
    );
    const interestPoints = allPoints.filter(
      (p) => p.papel === "interesse" || p.papel === "ambos",
    );

    if (candidates.length === 0)
      throw new Error(
        `O estudo não possui pontos marcados como candidato ou ambos.`,
      );
    if (interestPoints.length === 0)
      throw new Error(
        `O estudo não possui nenhum ponto de interesse (papel interesse ou ambos).`,
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

    const { data: scenario, error: scError } = await supabase
      .from("cenarios")
      .insert({
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
        custo_total_estimado: totalCost,
        executado_em: new Date().toISOString(),
      }).select().single();
      
      if (scError) throw new Error(`Erro ao criar cenário: ${scError.message}`);

      for (const gw of result.gateways) {
        const { data: scenarioGateway, error: gtwError } = await supabase.from("cenario_gateways")
        .insert({
            id_cenario: scenario.id_cenario,
            id_estudo_ponto: gw.candidato.id_estudo_ponto,
            quantidade_pontos_atenditos: gw.atendimentos.length,
            custo_estimado: gatewayCost
        }).select().single();
        if (gtwError) throw new Error(`Erro ao criar gateway do cenário: ${gtwError.message}.`);

        for (const at of gw.atendimentos) {
          const { error:atError } = await supabase.from("cenario_atendimentos").insert({
            id_cenario_gateway:  scenarioGateway.id_cenario_gateway,
            id_estudo_ponto: at.ponto.id_estudo_ponto,
            distancia_m: Math.round(at.distanciaM),
            nivel_sinal_estimado_dbm: Math.round(at.nivelSinalDbm * 10) /10,
          });
          if (atError) throw new Error(`Erro ao criar atendimento do cenário: ${atError.message}.`);
        }   
      }

      const notCoveredByType = new Map<string, number>();
      for (const point of result.pontosNaoCobertos) {
        const tipo = point.tipo_ativo ?? "desconhecido";
        notCoveredByType.set(tipo, (notCoveredByType.get(tipo) ?? 0) + 1);
      }

      const totalByType = new Map<string, number>();
      for (const point of result.pontosNaoCobertos) {
        const tipo = point.tipo_ativo ?? "desconhecido";
        notCoveredByType.set(tipo, (notCoveredByType.get(tipo) ?? 0) + 1);
      }

      const byCategory = [...totalByType.entries()].map(
        ([tipo, total]) => ({tipo_ativo: tipo, total, nao_cobertos: notCoveredByType.get(tipo) ?? 0}),
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
            nivel_sinal_estimado_dbm: Math.round(a.nivelSinalDbm * 10)/10,
          }))
        }))
      }
  }
}
