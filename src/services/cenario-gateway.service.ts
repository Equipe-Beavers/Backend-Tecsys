import { supabase } from "../lib/supabase.js";

import type {
    CenarioGateway,
    CriarCenarioGateway
} from "../models/cenario-gateway.js";
import { verificarRegistro } from "./validacao.service.js";

export async function criarCenarioGateway(
    dados: CriarCenarioGateway
): Promise<CenarioGateway> {

    await verificarRegistro("cenarios", "id_cenario", dados.id_cenario, "Cenário");
    await verificarRegistro(
        "estudo_pontos",
        "id_estudo_ponto",
        dados.id_estudo_ponto,
        "Ponto do estudo"
    );

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