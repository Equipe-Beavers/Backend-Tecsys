// Column names follow the approved database model; application names are English.
export class CreateInstallCriterionDTO {
  declare id_usuario: number;
  declare nome: string;
  declare tipos_elementos_permitidos?: unknown;
  declare tipos_elementos_proibidos?: unknown;
  declare distancia_minima_ativos_m?: number | null;
  declare distancia_maxima_ativos_m?: number | null;
  declare limite_gateways?: number | null;
  declare relevo?: unknown;
}

export class InstallCriterionDTO extends CreateInstallCriterionDTO {
  declare id_criterio_instalacao: number;
  declare criado_em: string;
  declare atualizado_em: string | null;
}

export class ListInstallCriteriaDTO {
  declare id_usuario?: number;
  declare page?: number;
  declare limit?: number;
}
