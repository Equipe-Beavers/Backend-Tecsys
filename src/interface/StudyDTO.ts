enum DelimitationType {
    draw = "desenho",
    selection = "selecao",
    spot = "mancha"
}

export interface StudyDTO {
    id_user: number;
    id_estudo: number;
    tipo_delimitacao: DelimitationType;
    uf?: string | null;
    bairro?: string | null;
}