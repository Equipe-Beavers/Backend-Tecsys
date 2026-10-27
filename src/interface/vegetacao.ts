/** Contratos da configuração usada para exibir a camada WMS de cobertura do solo. */
export interface VegetacaoClasseDTO {
    codigo: number;
    nome: string;
    cor: string;
}

export interface VegetacaoConfigDTO {
    provider: string;
    product: string;
    service: "WMS";
    baseUrl: string;
    layer: string;
    version: string;
    format: string;
    transparent: boolean;
    attribution: string;
    uso: "visualizacao";
    classes: VegetacaoClasseDTO[];
    observacao: string;
}
