export type OrigemEstudoPonto =
    | "bdgd"
    | "csv"
    | "manual";

export type PapelEstudoPonto =
    | "candidato"
    | "interesse"
    | "ambos";

export type PrioridadeEstudoPonto =
    | "normal"
    | "alta"
    | "critico";

export interface EstudoPonto {
    id_estudo_ponto: number;
    id_estudo: number;

    origem: OrigemEstudoPonto;

    id_ativo_bdgd: string | null;
    tipo_ativo: string | null;
    rotulo: string | null;

    papel: PapelEstudoPonto;
    prioridade: PrioridadeEstudoPonto | null;

    latitude: number;
    longitude: number;

    atributos: Record<string, unknown> | null;

    geom: unknown | null;

    criado_em: string;
}

export interface CriarEstudoPonto {
    id_estudo: number;

    origem: OrigemEstudoPonto;

    id_ativo_bdgd?: string | null;
    tipo_ativo?: string | null;
    rotulo?: string | null;

    papel: PapelEstudoPonto;
    prioridade?: PrioridadeEstudoPonto | null;

    latitude: number;
    longitude: number;

    atributos?: Record<string, unknown> | null;
}