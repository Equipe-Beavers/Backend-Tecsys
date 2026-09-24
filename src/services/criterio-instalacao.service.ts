import { supabase } from "../lib/supabase.js";

import type {
    CriterioInstalacao,
    CriarCriterioInstalacao
} from "../models/criterio-instalacao.js";

export async function criarCriterioInstalacao(
    dados: CriarCriterioInstalacao
): Promise<CriterioInstalacao> {

    const { data: usuario, error: erroUsuario } = await supabase
        .from("usuarios")
        .select("id_usuario")
        .eq("id_usuario", dados.id_usuario)
        .maybeSingle();

    if (erroUsuario) {
        throw new Error(
            `Erro ao consultar usuário: ${erroUsuario.message}`
        );
    }

    if (!usuario) {
        throw new Error("Usuário não encontrado");
    }

    const criterio = {
        id_usuario: dados.id_usuario,
        nome: dados.nome.trim(),
        descricao: dados.descricao?.trim() || null,
        tipos_elementos_permitidos: dados.tipos_elementos_permitidos ?? null,
        tipos_elementos_proibidos: dados.tipos_elementos_proibidos ?? null,
        requer_alimentacao_eletrica: dados.requer_alimentacao_eletrica ?? null,
        altura_minima_m: dados.altura_minima_m ?? null,
        distancia_maxima_ativos_m: dados.distancia_maxima_ativos_m ?? null,
        caracteristicas_minimas_local: dados.caracteristicas_minimas_local ?? null,
        locais_autorizados: dados.locais_autorizados ?? null,
        locais_obrigatorios: dados.locais_obrigatorios ?? null,
        locais_proibidos: dados.locais_proibidos ?? null,
        limite_gateways: dados.limite_gateways ?? null,
        custo_maximo: dados.custo_maximo ?? null
    };

    const { data, error } = await supabase
        .from("criterios_instalacao")
        .insert(criterio)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar critério de instalação: ${error.message}`
        );
    }

    return data as CriterioInstalacao;
}