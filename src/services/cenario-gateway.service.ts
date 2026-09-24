import { supabase } from "../lib/supabase.js";

import type {
    CenarioGateway,
    CriarCenarioGateway
} from "../models/cenario-gateway.js";

export async function criarCenarioGateway(
    dados: CriarCenarioGateway
): Promise<CenarioGateway> {

    const { data: cenario, error: erroCenario } = await supabase
        .from("cenarios")
        .select("id_cenario")
        .eq("id_cenario", dados.id_cenario)
        .maybeSingle();

    if (erroCenario) {
        throw new Error(
            `Erro ao consultar cenário: ${erroCenario.message}`
        );
    }

    if (!cenario) {
        throw new Error("Cenário não encontrado");
    }

    const { data: ponto, error: erroPonto } = await supabase
        .from("estudo_pontos")
        .select("id_estudo_ponto")
        .eq("id_estudo_ponto", dados.id_estudo_ponto)
        .maybeSingle();

    if (erroPonto) {
        throw new Error(
            `Erro ao consultar ponto do estudo: ${erroPonto.message}`
        );
    }

    if (!ponto) {
        throw new Error("Ponto do estudo não encontrado");
    }

    const gateway = {
        id_cenario: dados.id_cenario,
        id_estudo_ponto: dados.id_estudo_ponto,
        ordem: dados.ordem ?? null,
        quantidade_pontos_atendidos: dados.quantidade_pontos_atendidos ?? null,
        capacidade_utilizada_pct: dados.capacidade_utilizada_pct ?? null,
        custo_estimado: dados.custo_estimado ?? null,
        parametros_calculo: dados.parametros_calculo ?? null,
        mancha_cobertura: dados.mancha_cobertura ?? null
    };

    const { data, error } = await supabase
        .from("cenario_gateways")
        .insert(gateway)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar gateway do cenário: ${error.message}`
        );
    }

    return data as CenarioGateway;
}