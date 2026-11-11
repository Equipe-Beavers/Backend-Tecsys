export interface StudyExportQuery {
    /** Cenário selecionado na tela (aba aberta). Sem ele, usa o cenário otimizado. */
    id_cenario?: number;
    /** Padrão true: o PDF traz todos os cenários do estudo e o comparativo. Só false restringe ao selecionado. */
    incluir_alternativas?: boolean;
    /** Imagem (base64 PNG/JPEG) do mapa do cenário selecionado. */
    imagem_mapa?: string | null;
    /** Imagens dos mapas dos demais cenários, indexadas pelo id_cenario. */
    imagens_mapa?: Record<string, string | null>;
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

export interface ExportRfProfile {
    nome: string | null;
    modelo_gateway: string | null;
    frequencia_mhz: number | null;
    potencia_transmissao_dbm: number | null;
    sensibilidade_recepcao_dbm: number | null;
    alcance_estimado_m: number | null;
    altura_gateway_m: number | null;
    altura_dispositivo_m: number | null;
    capacidade_max_equipamentos: number | null;
    quantidade_canais: number | null;
    custo_estimado_gateway: number | null;
}

export interface ExportCriterion {
    nome: string | null;
    distancia_minima_ativos_m: number | null;
    distancia_maxima_ativos_m: number | null;
    altura_minima_m: number | null;
    limite_gateways: number | null;
    custo_maximo: number | null;
}

export interface ExportScenario {
    id_cenario: number;
    nome: string;
    /** "Otimizada" ou "Alt. N", como nas abas da aplicação. */
    rotulo: string;
    otimizado: boolean;
    selecionado: boolean;
    descricao: string | null;
    objetivo: string | null;
    status: string;
    nome_perfil_rf: string | null;
    capacidade_max_equipamentos: number | null;
    perfil_rf: ExportRfProfile | null;
    criterio: ExportCriterion | null;
    imagem_mapa: Buffer | null;
    executado_em: Date | null;
    indicadores: ExportIndicators;
    por_categoria: ExportCategory[];
    gateways: ExportGateway[];
    ativos_atendidos: ExportCoveredAsset[];
    ativos_nao_atendidos: ExportAsset[];
}

export interface StudyExportReport {
    gerado_em: Date;
    estudo: ExportStudyInfo;
    cenario_selecionado: ExportScenario;
    /** Demais cenários do estudo (só quando incluir_alternativas), do otimizado às alternativas. */
    outros_cenarios: ExportScenario[];
}
