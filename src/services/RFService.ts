import { pool } from "../database/pool.js";
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

    const perfil = [
      rfData.id_usuario,
      rfData.nome.trim(),
      rfData.modelo_gateway ?? null,
      rfData.frequencia_mhz,
      rfData.potencia_transmissao_dbm,
      rfData.sensibilidade_recepcao_dbm,
      rfData.alcance_estimado_m ?? null,
      rfData.altura_gateway_m ?? null,
      rfData.altura_dispositivo_m ?? null,
      rfData.capacidade_max_equipamentos ?? null,
      rfData.quantidade_canais ?? null,
      rfData.limite_mensagens_transmissoes ?? null,
      rfData.periodo_limite_mensagens ?? null,
      rfData.custo_estimado_gateway ?? null,
      rfData.caracteristicas_antena ?? null,
      rfData.considera_relevo ?? true,
      rfData.considera_vegetacao ?? true,
      rfData.considera_edificacoes ?? true,
      rfData.considera_obstaculos ?? true,
      rfData.parametros_adicionais ?? null,
    ];

    const query = `
      INSERT INTO perfis_rf 
      (id_usuario, nome, modelo_gateway, frequencia_mhz, potencia_transmissao_dbm, sensibilidade_recepcao_dbm, alcance_estimado_m, altura_gateway_m, altura_dispositivo_m, capacidade_max_equipamentos, quantidade_canais, limite_mensagens_transmissoes, periodo_limite_mensagens, custo_estimado_gateway, caracteristicas_antena, considera_relevo, considera_vegetacao, considera_edificacoes, considera_obstaculos, parametros_adicionais)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *;
    `;

    const result = await pool.query(query, perfil);

    if (!result.rows[0]) throw new Error("Erro ao criar perfil de RF.");
    return result.rows[0] as PerfilRf;
  }
}