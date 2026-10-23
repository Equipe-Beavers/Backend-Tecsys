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
