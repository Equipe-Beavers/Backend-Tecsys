export interface CriterioInstalacao {
    id_criterio_instalacao: number;
    id_usuario: number;
    nome: string;
    descricao: string | null;
    tipos_elementos_permitidos: Record<string, unknown> | null;
    tipos_elementos_proibidos: Record<string, unknown> | null;
    requer_alimentacao_eletrica: boolean | null;
    altura_minima_m: number | null;
    distancia_maxima_ativos_m: number | null;
    caracteristicas_minimas_local: Record<string, unknown> | null;
    locais_autorizados: Record<string, unknown> | null;
    locais_obrigatorios: Record<string, unknown> | null;
    locais_proibidos: Record<string, unknown> | null;
    limite_gateways: number | null;
    custo_maximo: number | null;
    criado_em: string;
    atualizado_em: string | null;
}

export interface CriarCriterioInstalacao {
    id_usuario: number;
    nome: string;
    descricao?: string | null;
    tipos_elementos_permitidos?: Record<string, unknown> | null;
    tipos_elementos_proibidos?: Record<string, unknown> | null;
    requer_alimentacao_eletrica?: boolean | null;
    altura_minima_m?: number | null;
    distancia_maxima_ativos_m?: number | null;
    caracteristicas_minimas_local?: Record<string, unknown> | null;
    locais_autorizados?: Record<string, unknown> | null;
    locais_obrigatorios?: Record<string, unknown> | null;
    locais_proibidos?: Record<string, unknown> | null;
    limite_gateways?: number | null;
    custo_maximo?: number | null;
}