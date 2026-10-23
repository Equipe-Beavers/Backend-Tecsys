import { supabase } from "../database/supabase.js";
import type { CriarPerfilRf, PerfilRf } from "../interface/perfil-rf.js";
import { ValidationService } from "./ValidationService.js";

export class RFService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  async createRFProfile(rfData: CriarPerfilRf): Promise<PerfilRf> {
    await this.validationService.verifyRecord(
      "usuarios",
      "id_usuario",
      rfData.id_usuario,
      "Usuário",
    );

    const perfil = {
      id_usuario: rfData.id_usuario,
      nome: rfData.nome.trim(),
      modelo_gateway: rfData.modelo_gateway ?? null,
      frequencia_mhz: rfData.frequencia_mhz,
      potencia_transmissao_dbm: rfData.potencia_transmissao_dbm,
      sensibilidade_recepcao_dbm: rfData.sensibilidade_recepcao_dbm,
      alcance_estimado_m: rfData.alcance_estimado_m ?? null,
      altura_gateway_m: rfData.altura_gateway_m ?? null,
      altura_dispositivo_m: rfData.altura_dispositivo_m ?? null,
      capacidade_max_equipamentos: rfData.capacidade_max_equipamentos ?? null,
      quantidade_canais: rfData.quantidade_canais ?? null,
      limite_mensagens_transmissoes:
        rfData.limite_mensagens_transmissoes ?? null,
      periodo_limite_mensagens: rfData.periodo_limite_mensagens ?? null,
      custo_estimado_gateway: rfData.custo_estimado_gateway ?? null,
      caracteristicas_antena: rfData.caracteristicas_antena ?? null,
      considera_relevo: rfData.considera_relevo ?? true,
      considera_vegetacao: rfData.considera_vegetacao ?? true,
      considera_edificacoes: rfData.considera_edificacoes ?? true,
      considera_obstaculos: rfData.considera_obstaculos ?? true,
      parametros_adicionais: rfData.parametros_adicionais ?? null,
    };

    const { data, error } = await supabase.from("perfis_rf")
    .insert(perfil).select().single();

    if (error) throw new Error(`Erro ao criar perfil de RF: ${error.message}`);
    return data as PerfilRf;
  }
}
