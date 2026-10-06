import { supabase } from "../database/supabase.js";
import type {
  CreateInstallCriterionDTO,
  InstallCriterionDTO,
  ListInstallCriteriaDTO,
} from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "../utils/InstallCriterionError.js";

export class InstallCriterionService {
  private readonly fields = [
    "id_usuario", "nome", "tipos_elementos_permitidos",
    "tipos_elementos_proibidos", "requer_alimentacao_eletrica",
    "distancia_maxima_ativos_m", "locais_autorizados",
    "locais_obrigatorios", "locais_proibidos", "limite_gateways",
  ] as const;

  private readonly columns = [
    "id_criterio_instalacao", ...this.fields, "criado_em", "atualizado_em",
  ].join(",");

  private prepareData(input: Partial<CreateInstallCriterionDTO>, create: boolean) {
    const data: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (Object.hasOwn(input, field)) data[field] = input[field];
      else if (create) data[field] = null;
    }
    if (input.nome !== undefined) data.nome = input.nome.trim();
    return data;
  }

  async createInstallCriterion(input: CreateInstallCriterionDTO): Promise<InstallCriterionDTO> {
    const { data, error } = await supabase.from("criterios_instalacao")
      .insert({ ...this.prepareData(input, true), criado_em: new Date().toISOString() })
      .select(this.columns).single();
    // The foreign key validates the user atomically, without a preliminary query.
    if (error?.code === "23503") {
      throw new InstallCriterionError(400, "Usuário não encontrado.");
    }
    if (error) throw error;
    return data as unknown as InstallCriterionDTO;
  }

  async listInstallCriteria(input: ListInstallCriteriaDTO) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    let query = supabase.from("criterios_instalacao").select(this.columns);
    if (input.id_usuario !== undefined) query = query.eq("id_usuario", input.id_usuario);
    const { data, error } = await query.order("id_criterio_instalacao")
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    return { data: (data ?? []) as unknown as InstallCriterionDTO[], page, limit };
  }

  async getInstallCriterion(id: number): Promise<InstallCriterionDTO> {
    const { data, error } = await supabase.from("criterios_instalacao")
      .select(this.columns).eq("id_criterio_instalacao", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
    return data as unknown as InstallCriterionDTO;
  }

  async updateInstallCriterion(id: number, input: Partial<CreateInstallCriterionDTO>): Promise<InstallCriterionDTO> {
    const { data, error } = await supabase.from("criterios_instalacao")
      .update({ ...this.prepareData(input, false), atualizado_em: new Date().toISOString() })
      .eq("id_criterio_instalacao", id).select(this.columns).maybeSingle();
    if (error?.code === "23503") {
      throw new InstallCriterionError(400, "Usuário não encontrado.");
    }
    if (error) throw error;
    if (!data) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
    return data as unknown as InstallCriterionDTO;
  }

  async deleteInstallCriterion(id: number): Promise<void> {
    // The database foreign key is authoritative, including concurrent changes.
    const { data, error } = await supabase.from("criterios_instalacao")
      .delete().eq("id_criterio_instalacao", id)
      .select("id_criterio_instalacao").maybeSingle();
    if (error?.code === "23503") {
      throw new InstallCriterionError(409, "O critério de instalação está em uso e não pode ser excluído.");
    }
    if (error) throw error;
    if (!data) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
  }
}
