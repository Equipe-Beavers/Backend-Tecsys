import { supabase } from "../lib/supabase.js";

import type {
    CriarEstudoPonto,
    EstudoPonto
} from "../models/estudo-ponto.js";
import { verificarRegistro } from "./validacao.service.js";

export async function criarEstudoPonto(
    dados: CriarEstudoPonto
): Promise<EstudoPonto> {

    await verificarRegistro("estudos", "id_estudo", dados.id_estudo, "Estudo");

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