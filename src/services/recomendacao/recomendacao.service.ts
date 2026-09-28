import { supabase } from "../../lib/supabase.js";
import type { EstudoPonto } from "../../models/estudo-ponto.js";
import type { PerfilRf } from "../../models/perfil-rf.js";
import { calcularRecomendacao } from "./algoritmo.js";

export interface GerarRecomendacaoInput {
  id_estudo: number;
  id_perfil_rf: number;
  id_criterio_instalacao?: number | null;
  nome_cenario?: string;
}

export async function gerarRecomendacao(input: GerarRecomendacaoInput) {
  const { data: estudo, error: erroEstudo } = await supabase
    .from("estudos")
    .select("id_estudo")
    .eq("id_estudo", input.id_estudo)
    .maybeSingle();
  if (erroEstudo) throw new Error(`Erro ao consultar estudo: ${erroEstudo.message}`);
  if (!estudo) throw new Error("Estudo não encontrado");

  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfis_rf")
    .select("*")
    .eq("id_perfil_rf", input.id_perfil_rf)
    .maybeSingle();
  if (erroPerfil) throw new Error(`Erro ao consultar perfil RF: ${erroPerfil.message}`);
  if (!perfil) throw new Error("Perfil RF não encontrado");

  const { data: pontos, error: erroPontos } = await supabase
    .from("estudo_pontos")
    .select("*")
    .eq("id_estudo", input.id_estudo);
  if (erroPontos) throw new Error(`Erro ao consultar pontos do estudo: ${erroPontos.message}`);

  const todosPontos = (pontos ?? []) as EstudoPonto[];
  const candidatos = todosPontos.filter((p) => p.papel === "candidato" || p.papel === "ambos");
  const pontosInteresse = todosPontos.filter((p) => p.papel === "interesse" || p.papel === "ambos");

  if (candidatos.length === 0) throw new Error("O estudo não tem nenhum ponto marcado como candidato ou ambos.");
  if (pontosInteresse.length === 0) throw new Error("O estudo não tem nenhum ponto de interesse (papel interesse ou ambos).");

  const resultado = calcularRecomendacao(candidatos, pontosInteresse, perfil as PerfilRf);

  const totalInteresse = pontosInteresse.length;
  const totalCobertos = totalInteresse - resultado.pontosNaoCobertos.length;
  const custoGateway = (perfil as PerfilRf).custo_estimado_gateway ?? 0; 
  const custoTotal = resultado.gateways.length * custoGateway;

  const { data: cenario, error: erroCenario } = await supabase
    .from("cenarios")
    .insert({
      id_estudo: input.id_estudo,
      id_perfil_rf: input.id_perfil_rf,
      id_criterio_instalacao: input.id_criterio_instalacao ?? null,
      nome: input.nome_cenario ?? `Recomendação inicial - estudo ${input.id_estudo}`,
      status: "DEFINITIVO",
      quantidade_gateways: resultado.gateways.length,
      pontos_interesse: totalInteresse,
      pontos_cobertos: totalCobertos,
      pontos_nao_cobertos: resultado.pontosNaoCobertos.length,
      percentual_cobertura: totalInteresse > 0 ? Math.round((totalCobertos / totalInteresse) * 100) : 0,
      custo_total_estimado: custoTotal,
      executado_em: new Date().toISOString(),
    })
    .select()
    .single();
  if (erroCenario) throw new Error(`Erro ao criar cenário: ${erroCenario.message}`);

  for (const gw of resultado.gateways) {
    const { data: cenarioGateway, error: erroGw } = await supabase
      .from("cenario_gateways")
      .insert({
        id_cenario: cenario.id_cenario,
        id_estudo_ponto: gw.candidato.id_estudo_ponto,
        quantidade_pontos_atendidos: gw.atendimentos.length,
        custo_estimado: custoGateway,
      })
      .select()
      .single();
    if (erroGw) throw new Error(`Erro ao criar gateway do cenário: ${erroGw.message}`);

    for (const at of gw.atendimentos) {
      const { error: erroAt } = await supabase.from("cenario_atendimentos").insert({
        id_cenario_gateway: cenarioGateway.id_cenario_gateway,
        id_estudo_ponto: at.ponto.id_estudo_ponto,
        distancia_m: Math.round(at.distanciaM),
        nivel_sinal_estimado_dbm: Math.round(at.nivelSinalDbm * 10) / 10,
      });
      if (erroAt) throw new Error(`Erro ao criar atendimento do cenário: ${erroAt.message}`);
    }
  }

  return {
    id_cenario: cenario.id_cenario,
    quantidade_gateways: resultado.gateways.length,
    percentual_cobertura: cenario.percentual_cobertura,
    custo_total_estimado: custoTotal,
    pontos_interesse: totalInteresse,
    pontos_cobertos: totalCobertos,
    pontos_nao_cobertos: resultado.pontosNaoCobertos.length,
    gateways: resultado.gateways.map((gw) => ({
      id_estudo_ponto: gw.candidato.id_estudo_ponto,
      rotulo: gw.candidato.rotulo,
      latitude: gw.candidato.latitude,
      longitude: gw.candidato.longitude,
      quantidade_atendidos: gw.atendimentos.length,
      atendidos: gw.atendimentos.map((a) => ({
        id_estudo_ponto: a.ponto.id_estudo_ponto,
        tipo_ativo: a.ponto.tipo_ativo,
        distancia_m: Math.round(a.distanciaM),
        nivel_sinal_estimado_dbm: Math.round(a.nivelSinalDbm * 10) / 10,
      })),
    })),
  };
}