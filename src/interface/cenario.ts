export type StatusCenario = string;

export interface Cenario {
    id_cenario: number;
    id_estudo: number;
    id_perfil_rf: number;
    id_criterio_instalacao: number | null;
    id_cenario_base: number | null;
    nome: string;
    descricao: string | null;
    objetivo: string | null;
    status: StatusCenario;
    quantidade_gateways: number | null;
    pontos_interesse: number | null;
    pontos_cobertos: number | null;
    pontos_nao_cobertos: number | null;
    percentual_cobertura: number | null;
    capacidade_utilizada_media_pct: number | null;
    custo_total_estimado: number | null;
    mancha_consolidada: unknown | null;
    executado_em: string | null;
    criado_em: string;
    atualizado_em: string | null;
}

export interface CriarCenario {
    id_estudo: number;
    id_perfil_rf: number;
    id_criterio_instalacao?: number | null;
    id_cenario_base?: number | null;
    nome: string;
    descricao?: string | null;
    objetivo?: string | null;
    status: StatusCenario;
    quantidade_gateways?: number | null;
    pontos_interesse?: number | null;
    pontos_cobertos?: number | null;
    pontos_nao_cobertos?: number | null;
    percentual_cobertura?: number | null;
    capacidade_utilizada_media_pct?: number | null;
    custo_total_estimado?: number | null;
    mancha_consolidada?: unknown | null;
    executado_em?: string | null;
}