import type { CreateInstallCriterionDTO, InstallCriterionDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "./InstallCriterionError.js";

export class InstallCriterionUtils {
  private readonly fields = [
    "id_usuario", "nome", "tipos_elementos_permitidos", "tipos_elementos_proibidos",
    "requer_alimentacao_eletrica", "distancia_maxima_ativos_m", "locais_autorizados",
    "locais_obrigatorios", "locais_proibidos", "limite_gateways",
  ] as const;

  PrepareData(input: Partial<CreateInstallCriterionDTO>): string {
    const data: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (Object.hasOwn(input, field)) data[field] = input[field];
    }
    if (input.nome !== undefined) data.nome = input.nome.trim();
    return JSON.stringify(data);
  }

  MapRow(row: Record<string, unknown>): InstallCriterionDTO {
    const id = Number(row.id_criterio_instalacao);
    const userId = Number(row.id_usuario);
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(userId)) {
      throw new Error("Criterion identifier exceeds the supported integer range.");
    }
    return {
      ...row,
      id_criterio_instalacao: id,
      id_usuario: userId,
      distancia_maxima_ativos_m: row.distancia_maxima_ativos_m == null ? null : Number(row.distancia_maxima_ativos_m),
      criado_em: row.criado_em instanceof Date ? row.criado_em.toISOString() : row.criado_em,
      atualizado_em: row.atualizado_em instanceof Date ? row.atualizado_em.toISOString() : row.atualizado_em,
    } as InstallCriterionDTO;
  }

  RethrowDatabaseError(error: unknown, deleting = false): never {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
      throw new InstallCriterionError(
        deleting ? 409 : 400,
        deleting ? "O critério de instalação está em uso e não pode ser excluído." : "Usuário não encontrado.",
      );
    }
    throw error;
  }
}
