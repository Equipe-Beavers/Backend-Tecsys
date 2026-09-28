import { supabase } from "../lib/supabase.js";

import type {
    Cenario,
    CriarCenario
} from "../models/cenario.js";
import { verificarRegistro } from "./validacao.service.js";

export async function criarCenario(
    dados: CriarCenario
): Promise<Cenario> {

    await verificarRegistro("estudos", "id_estudo", dados.id_estudo, "Estudo");
    await verificarRegistro("perfis_rf", "id_perfil_rf", dados.id_perfil_rf, "Perfil RF");

    if (dados.id_criterio_instalacao != null) {
        await verificarRegistro(
            "criterios_instalacao",
            "id_criterio_instalacao",
            dados.id_criterio_instalacao,
            "Critério de instalação"
        );
    }

    if (dados.id_cenario_base != null) {
        await verificarRegistro(
            "cenarios",
            "id_cenario",
            dados.id_cenario_base,
            "Cenário base"
        );
    }

    const cenario = {
        id_estudo: dados.id_estudo,
        id_perfil_rf: dados.id_perfil_rf,
        id_criterio_instalacao: dados.id_criterio_instalacao ?? null,
        id_cenario_base: dados.id_cenario_base ?? null,
        nome: dados.nome.trim(),
        descricao: dados.descricao?.trim() || null,
        objetivo: dados.objetivo?.trim() || null,
        status: dados.status,
        quantidade_gateways: dados.quantidade_gateways ?? null,
        pontos_interesse: dados.pontos_interesse ?? null,
        pontos_cobertos: dados.pontos_cobertos ?? null,
        pontos_nao_cobertos: dados.pontos_nao_cobertos ?? null,
        percentual_cobertura: dados.percentual_cobertura ?? null,
        capacidade_utilizada_media_pct: dados.capacidade_utilizada_media_pct ?? null,
        custo_total_estimado: dados.custo_total_estimado ?? null,
        mancha_consolidada: dados.mancha_consolidada ?? null,
        executado_em: dados.executado_em ?? null
    };

    const { data, error } = await supabase
        .from("cenarios")
        .insert(cenario)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar cenário: ${error.message}`
        );
    }

    return data as Cenario;
}