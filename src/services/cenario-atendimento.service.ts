import { supabase } from "../lib/supabase.js";

import type {
    CenarioAtendimento,
    CriarCenarioAtendimento
} from "../models/cenario-atendimento.js";

export async function criarCenarioAtendimento(
    dados: CriarCenarioAtendimento
): Promise<CenarioAtendimento> {

    const { data: gateway, error: erroGateway } = await supabase
        .from("cenario_gateways")
        .select("id_cenario_gateway")
        .eq("id_cenario_gateway", dados.id_cenario_gateway)
        .maybeSingle();

    if (erroGateway) {
        throw new Error(
            `Erro ao consultar gateway do cenário: ${erroGateway.message}`
        );
    }

    if (!gateway) {
        throw new Error("Gateway do cenário não encontrado");
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

    const atendimento = {
        id_cenario_gateway: dados.id_cenario_gateway,
        id_estudo_ponto: dados.id_estudo_ponto,
        distancia_m: dados.distancia_m ?? null,
        nivel_sinal_estimado_dbm: dados.nivel_sinal_estimado_dbm ?? null
    };

    const { data, error } = await supabase
        .from("cenario_atendimentos")
        .insert(atendimento)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar atendimento do cenário: ${error.message}`
        );
    }

    return data as CenarioAtendimento;
}