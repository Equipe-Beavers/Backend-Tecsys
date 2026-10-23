export interface CenarioAtendimento {
    id_atendimento: number;
    id_cenario_gateway: number;
    id_estudo_ponto: number;
    distancia_m: number | null;
    nivel_sinal_estimado_dbm: number | null;
    criado_em: string;
}

export interface CriarCenarioAtendimento {
    id_cenario_gateway: number;
    id_estudo_ponto: number;
    distancia_m?: number | null;
    nivel_sinal_estimado_dbm?: number | null;
}