export interface StudyExportQuery {
    id_cenario?: number;
    incluir_alternativas?: boolean;
    imagem_mapa?: string | null;
}

export interface ExportStudyInfo {
    id_estudo: number;
    nome: string;
    descricao: string | null;
    tipo_delimitacao: string;
    regiao: string;
    uf: string | null;
    municipio: string | null;
    bairro: string | null;
    distribuidora: string | null;
    versao_bdgd: string | null;
    status: string;
    nome_perfil_rf: string | null;
    nome_criterio_instalacao: string | null;
    criado_em: Date | null;
}

export interface ExportAsset {
    id_estudo_ponto: number;
    identificacao: string;
    tipo_ativo: string | null;
    latitude: number | null;
    longitude: number | null;
}

export interface ExportCoveredAsset extends ExportAsset {
    gateway: string;
    distancia_m: number | null;
    nivel_sinal_estimado_dbm: number | null;
}

export interface ExportGateway extends ExportAsset {
    id_cenario_gateway: number;
    quantidade_atendidos: number;
    capacidade_utilizada_pct: number | null;
    alcance_medio_m: number | null;
}

export interface ExportCategory {
    tipo_ativo: string;
    total: number;
    atendidos: number;
    nao_atendidos: number;
}

export interface ExportIndicators {
    quantidade_gateways: number;
    pontos_interesse: number;
    pontos_cobertos: number;
    pontos_nao_cobertos: number;
    percentual_cobertura: number;
    capacidade_utilizada_media_pct: number | null;
    custo_total_estimado: number | null;
}

export interface ExportScenario {
    id_cenario: number;
    nome: string;
    descricao: string | null;
    status: string;
    nome_perfil_rf: string | null;
    capacidade_max_equipamentos: number | null;
    executado_em: Date | null;
    final: boolean;
    indicadores: ExportIndicators;
    por_categoria: ExportCategory[];
    gateways: ExportGateway[];
    ativos_atendidos: ExportCoveredAsset[];
    ativos_nao_atendidos: ExportAsset[];
}

export interface StudyExportReport {
    gerado_em: Date;
    estudo: ExportStudyInfo;
    imagem_mapa: Buffer | null;
    cenario_final: ExportScenario;
    alternativas: ExportScenario[];
}
