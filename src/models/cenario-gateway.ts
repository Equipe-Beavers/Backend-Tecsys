export interface CenarioGateway {
    id_cenario_gateway: number;
    id_cenario: number;
    id_estudo_ponto: number;
    ordem: number | null;
    quantidade_pontos_atendidos: number | null;
    capacidade_utilizada_pct: number | null;
    custo_estimado: number | null;
    parametros_calculo: Record<string, unknown> | null;
    mancha_cobertura: unknown | null;
}

export interface CriarCenarioGateway {
    id_cenario: number;
    id_estudo_ponto: number;
    ordem?: number | null;
    quantidade_pontos_atendidos?: number | null;
    capacidade_utilizada_pct?: number | null;
    custo_estimado?: number | null;
    parametros_calculo?: Record<string, unknown> | null;
    mancha_cobertura?: unknown | null;
}