import { supabase } from "../database/supabase.js";
import type { CriarEstudoPonto, EstudoPonto } from "../interface/estudo-ponto.js";
import type { CriarEstudo, Estudo } from "../interface/estudo.js";
import { ValidationService } from "./ValidationService.js";

export class StudyService {
    private validationService: ValidationService;

    constructor() {
        this.validationService = new ValidationService();
    }

    async createStudy(studyData: CriarEstudo) {
        const estudo = {
        id_usuario: studyData.id_usuario,
        tipo_delimitacao: studyData.tipo_delimitacao,
        uf: studyData.uf ?? null,
        municipio: studyData.municipio ?? null,
        bairro: studyData.bairro ?? null,
        geom: studyData.geom ?? null,
        nome: studyData.nome.trim(),
        descricao: studyData.descricao?.trim() || null,
        distribuidora: studyData.distribuidora?.trim() || null,
        versao_bdgd: studyData.versao_bdgd?.trim() || null,
        nome_base_externa: studyData.nome_base_externa?.trim() || null,
        tipos_ativo_selecionados: studyData.tipos_ativo_selecionados ?? null,
        status: studyData.status ?? "AGUARDANDO_SELECAO",
        };

        const { data, error } = await supabase.from("estudos")
        .insert(estudo).select().single();

        if (error) throw new Error(`Erro ao criar estudo: ${error.message}.`);
        return data as Estudo;
    }

    async createStudyPoint(studyData: CriarEstudoPonto): Promise<EstudoPonto> {
        await this.validationService.verifyRecord(
            "estudos",
            "id_estudo",
            studyData.id_estudo,
            "Estudo"
        );

        const geom = {
            type: "Point",
            coordinates: [
                studyData.longitude,
                studyData.latitude
            ]
        };

        const ponto = {
            id_estudo: studyData.id_estudo,
            origem: studyData.origem,
            id_ativo_bdgd: studyData.id_ativo_bdgd ?? null,
            tipo_ativo: studyData.tipo_ativo ?? null,
            rotulo: studyData.rotulo ?? null,
            papel: studyData.papel,
            prioridade: studyData.prioridade ?? null,
            latitude: studyData.latitude,
            longitude: studyData.longitude,
            atributos: studyData.atributos ?? null,
            geom
        }

        const { data, error } = await supabase.from("estudo_pontos")
        .insert(ponto).select().single();

        if (error) throw new Error(`Erro ao criar ponto do estudo: ${error.message}.`);
        return data as EstudoPonto;
    }
}
