export interface PerfilRf {
    id_perfil_rf: number;
    id_usuario: number;
    nome: string;
    modelo_gateway: string | null;
    frequencia_mhz: number;
    potencia_transmissao_dbm: number;
    sensibilidade_recepcao_dbm: number;
    alcance_estimado_m: number | null;
    altura_gateway_m: number | null;
    altura_dispositivo_m: number | null;
    capacidade_max_equipamentos: number | null;
    quantidade_canais: number | null;
    limite_mensagens_transmissoes: number | null;
    periodo_limite_mensagens: string | null;
    custo_estimado_gateway: number | null;
    caracteristicas_antena: Record<string, unknown> | null;
    considera_relevo: boolean;
    considera_vegetacao: boolean;
    considera_edificacoes: boolean;
    considera_obstaculos: boolean;
    parametros_adicionais: Record<string, unknown> | null;
    criado_em: string;
    atualizado_em: string | null;
}

export interface CriarPerfilRf {
    id_usuario: number;
    nome: string;
    modelo_gateway?: string | null;
    frequencia_mhz: number;
    potencia_transmissao_dbm: number;
    sensibilidade_recepcao_dbm: number;
    alcance_estimado_m?: number | null;
    altura_gateway_m?: number | null;
    altura_dispositivo_m?: number | null;
    capacidade_max_equipamentos?: number | null;
    quantidade_canais?: number | null;
    limite_mensagens_transmissoes?: number | null;
    periodo_limite_mensagens?: string | null;
    custo_estimado_gateway?: number | null;
    caracteristicas_antena?: Record<string, unknown> | null;
    considera_relevo?: boolean;
    considera_vegetacao?: boolean;
    considera_edificacoes?: boolean;
    considera_obstaculos?: boolean;
    parametros_adicionais?: Record<string, unknown> | null;
}