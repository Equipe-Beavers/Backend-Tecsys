import { supabase } from "../database/supabase.js";
import { pool } from "../database/pool.js";
import { createRFProfileQuery, deleteRFProfileQuery, getRFProfileQuery, listRFProfilesQuery, updateRFProfileQuery } from "../database/queries.js";
import type { CreateRFProfileInput, CriarPerfilRf, PerfilRf, RFProfileListItem, RFProfileListQuery, UpdateRFProfileInput } from "../interface/perfil-rf.js";
import { ValidationService } from "./ValidationService.js";

export class RFService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  async listRFProfiles(input: RFProfileListQuery) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const { rows } = await pool.query(listRFProfilesQuery, [
      input.id_usuario ?? null,
      limit,
      (page - 1) * limit,
    ]);
    return {
      data: rows.map((row): RFProfileListItem => this.mapLocalProfile(row)),
      page,
      limit,
    };
  }

  async createLocalRFProfile(input: CreateRFProfileInput): Promise<RFProfileListItem> {
    const profile = {
      id_usuario: input.id_usuario,
      nome: input.nome.trim(),
      frequencia_mhz: input.frequencia_mhz,
      potencia_transmissao_dbm: input.potencia_transmissao_dbm,
      sensibilidade_recepcao_dbm: input.sensibilidade_recepcao_dbm,
      altura_gateway_m: input.altura_gateway_m ?? null,
      altura_dispositivo_m: input.altura_dispositivo_m ?? null,
      capacidade_max_equipamentos: input.capacidade_max_equipamentos ?? null,
      atenuacao_adicional_db: input.atenuacao_adicional_db ?? null,
      considera_relevo: input.considera_relevo ?? true,
      considera_vegetacao: input.considera_vegetacao ?? true,
      considera_edificacoes: input.considera_edificacoes ?? true,
      considera_antenas: input.considera_antenas ?? true,
    };
    const { rows } = await pool.query(createRFProfileQuery, [JSON.stringify(profile)]);
    return this.mapLocalProfile(rows[0]);
  }

  async getLocalRFProfile(id: number): Promise<RFProfileListItem | null> {
    const { rows } = await pool.query(getRFProfileQuery, [id]);
    return rows[0] ? this.mapLocalProfile(rows[0]) : null;
  }

  async updateLocalRFProfile(
    id: number,
    input: UpdateRFProfileInput,
  ): Promise<RFProfileListItem | null> {
    const data = { ...input };
    if (data.nome !== undefined) data.nome = data.nome.trim();
    const { rows } = await pool.query(updateRFProfileQuery, [id, JSON.stringify(data)]);
    return rows[0] ? this.mapLocalProfile(rows[0]) : null;
  }

  async deleteLocalRFProfile(id: number): Promise<boolean> {
    const { rows } = await pool.query(deleteRFProfileQuery, [id]);
    return rows.length > 0;
  }

  private mapLocalProfile(row: Record<string, any>): RFProfileListItem {
    const id = Number(row.id_perfil_rf);
    const userId = Number(row.id_usuario);
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(userId)) {
      throw new Error("RF profile identifier exceeds the supported integer range.");
    }
    return {
        ...row,
        id_perfil_rf: id,
        id_usuario: userId,
          nome: String(row.nome),
        frequencia_mhz: Number(row.frequencia_mhz),
        potencia_transmissao_dbm: Number(row.potencia_transmissao_dbm),
        sensibilidade_recepcao_dbm: Number(row.sensibilidade_recepcao_dbm),
        altura_gateway_m: row.altura_gateway_m == null ? null : Number(row.altura_gateway_m),
        altura_dispositivo_m: row.altura_dispositivo_m == null ? null : Number(row.altura_dispositivo_m),
        capacidade_max_equipamentos: row.capacidade_max_equipamentos == null ? null : Number(row.capacidade_max_equipamentos),
        atenuacao_adicional_db: row.atenuacao_adicional_db == null ? null : Number(row.atenuacao_adicional_db),
        considera_relevo: Boolean(row.considera_relevo),
        considera_vegetacao: Boolean(row.considera_vegetacao),
        considera_edificacoes: Boolean(row.considera_edificacoes),
        considera_antenas: Boolean(row.considera_antenas),
        criado_em: row.criado_em instanceof Date ? row.criado_em.toISOString() : row.criado_em,
        atualizado_em: row.atualizado_em instanceof Date ? row.atualizado_em.toISOString() : row.atualizado_em,
    };
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