import { supabase } from "../lib/supabase.js";

import type {
    CriarPerfilRf,
    PerfilRf
} from "../models/perfil-rf.js";
import { verificarRegistro } from "./validacao.service.js";

export async function criarPerfilRf(
    dados: CriarPerfilRf
): Promise<PerfilRf> {

    await verificarRegistro("usuarios", "id_usuario", dados.id_usuario, "Usuário");

    const perfil = {
        id_usuario: dados.id_usuario,
        nome: dados.nome.trim(),
        modelo_gateway: dados.modelo_gateway ?? null,
        frequencia_mhz: dados.frequencia_mhz,
        potencia_transmissao_dbm: dados.potencia_transmissao_dbm,
        sensibilidade_recepcao_dbm: dados.sensibilidade_recepcao_dbm,
        alcance_estimado_m: dados.alcance_estimado_m ?? null,
        altura_gateway_m: dados.altura_gateway_m ?? null,
        altura_dispositivo_m: dados.altura_dispositivo_m ?? null,
        capacidade_max_equipamentos: dados.capacidade_max_equipamentos ?? null,
        quantidade_canais: dados.quantidade_canais ?? null,
        limite_mensagens_transmissoes: dados.limite_mensagens_transmissoes ?? null,
        periodo_limite_mensagens: dados.periodo_limite_mensagens ?? null,
        custo_estimado_gateway: dados.custo_estimado_gateway ?? null,
        caracteristicas_antena: dados.caracteristicas_antena ?? null,
        considera_relevo: dados.considera_relevo ?? true,
        considera_vegetacao: dados.considera_vegetacao ?? true,
        considera_edificacoes: dados.considera_edificacoes ?? true,
        considera_obstaculos: dados.considera_obstaculos ?? true,
        parametros_adicionais: dados.parametros_adicionais ?? null
    };

    const { data, error } = await supabase
        .from("perfis_rf")
        .insert(perfil)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar perfil RF: ${error.message}`
        );
    }

    return data as PerfilRf;
}