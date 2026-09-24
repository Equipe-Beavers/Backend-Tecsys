import { supabase } from "../lib/supabase.js";

import type {
    CriarEstudoPonto,
    EstudoPonto
} from "../models/estudo-ponto.js";

export async function criarEstudoPonto(
    dados: CriarEstudoPonto
): Promise<EstudoPonto> {

    const { data: estudo, error: erroEstudo } = await supabase
        .from("estudos")
        .select("id_estudo")
        .eq("id_estudo", dados.id_estudo)
        .maybeSingle();

    if (erroEstudo) {
        throw new Error(
            `Erro ao consultar estudo: ${erroEstudo.message}`
        );
    }

    if (!estudo) {
        throw new Error("Estudo não encontrado");
    }

    /*
     * GeoJSON utilizado pelo PostGIS/Supabase.
     *
     * IMPORTANTE:
     * GeoJSON usa a ordem:
     *
     * [longitude, latitude]
     */
    const geom = {
        type: "Point",
        coordinates: [
            dados.longitude,
            dados.latitude
        ]
    };

    const ponto = {
        id_estudo: dados.id_estudo,

        origem: dados.origem,

        id_ativo_bdgd: dados.id_ativo_bdgd ?? null,
        tipo_ativo: dados.tipo_ativo ?? null,
        rotulo: dados.rotulo ?? null,

        papel: dados.papel,
        prioridade: dados.prioridade ?? null,

        latitude: dados.latitude,
        longitude: dados.longitude,

        atributos: dados.atributos ?? null,

        geom
    };

    const { data, error } = await supabase
        .from("estudo_pontos")
        .insert(ponto)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar ponto do estudo: ${error.message}`
        );
    }

    return data as EstudoPonto;
}