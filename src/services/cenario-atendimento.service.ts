import { supabase } from "../lib/supabase.js";

import type {
    CenarioAtendimento,
    CriarCenarioAtendimento
} from "../models/cenario-atendimento.js";
import { verificarRegistro } from "./validacao.service.js";

export async function criarCenarioAtendimento(
    dados: CriarCenarioAtendimento
): Promise<CenarioAtendimento> {

    await verificarRegistro(
        "cenario_gateways",
        "id_cenario_gateway",
        dados.id_cenario_gateway,
        "Gateway do cenário"
    );
    await verificarRegistro(
        "estudo_pontos",
        "id_estudo_ponto",
        dados.id_estudo_ponto,
        "Ponto do estudo"
    );

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