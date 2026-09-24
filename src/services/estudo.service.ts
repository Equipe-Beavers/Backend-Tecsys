import { supabase } from "../lib/supabase.js";

import type {
    CriarEstudo,
    Estudo
} from "../models/estudo.js";

export async function criarEstudo(
    dados: CriarEstudo
): Promise<Estudo> {

    const estudo = {
        id_usuario: dados.id_usuario,

        tipo_delimitacao: dados.tipo_delimitacao,

        uf: dados.uf ?? null,
        municipio: dados.municipio ?? null,
        bairro: dados.bairro ?? null,

        geom: dados.geom ?? null,

        nome: dados.nome.trim(),
        descricao: dados.descricao?.trim() || null,

        distribuidora: dados.distribuidora?.trim() || null,
        versao_bdgd: dados.versao_bdgd?.trim() || null,
        nome_base_externa: dados.nome_base_externa?.trim() || null,

        tipos_ativo_selecionados:
            dados.tipos_ativo_selecionados ?? null,

        status:
            dados.status ?? "AGUARDANDO_SELECAO"
    };

    const { data, error } = await supabase
        .from("estudos")
        .insert(estudo)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar estudo: ${error.message}`
        );
    }

    return data as Estudo;
}