import type { CreateInstallCriterionDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "./InstallCriterionError.js";

export class InstallCriterionValidation {
  private fail(message: string): never {
    throw new InstallCriterionError(400, message);
  }

  private key(value: string): string {
    const key = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[\s-]+/g, "_");
    const aliases: Record<string, string> = {
      POSTE: "POSTES", SUBESTACAO: "SUBESTACOES", TORRE: "TORRES",
      EDIFICACAO_PROPRIA: "EDIFICACOES_PROPRIAS", RESERVATORIO: "RESERVATORIOS",
      POSTE_DE_TERCEIRO: "POSTES_TERCEIROS", POSTE_DE_TERCEIROS: "POSTES_TERCEIROS",
      POSTES_DE_TERCEIROS: "POSTES_TERCEIROS", ESTRUTURA_PROVISORIA: "ESTRUTURAS_PROVISORIAS",
    };
    return aliases[key] ?? key;
  }

  private object(value: unknown, label: string): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value)) this.fail(`${label} deve ser um objeto ou null.`);
    return value as Record<string, unknown>;
  }

  private list(value: unknown, label: string, legacyObject = false): string[] {
    if (value == null) return [];
    // Historical structured asset selections remain opaque and are not rewritten.
    if (legacyObject && typeof value === "object" && !Array.isArray(value)) return [];
    if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
      this.fail(`${label} deve ser uma lista de textos não vazios.`);
    }
    return (value as string[]).map(item => this.key(item));
  }

  private disjoint(allowed: string[], blocked: string[], label: string): void {
    const forbidden = new Set(blocked);
    if (allowed.some(item => forbidden.has(item))) this.fail(`${label}: uma opção não pode ser permitida e proibida ao mesmo tempo.`);
  }

  private number(section: Record<string, unknown>, field: string, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER, integer = false): void {
    const value = section[field];
    if (value == null) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      this.fail(`${label}.${field}: informe ${integer ? "um inteiro" : "um número"} entre ${minimum} e ${maximum}.`);
    }
  }

  Validate(input: Partial<CreateInstallCriterionDTO>): void {
    if (input.distancia_minima_ativos_m != null && input.distancia_maxima_ativos_m != null
      && input.distancia_minima_ativos_m > input.distancia_maxima_ativos_m) {
      this.fail("A distância mínima não pode ultrapassar a distância máxima.");
    }
    this.disjoint(
      this.list(input.tipos_elementos_permitidos, "Ativos permitidos", true),
      this.list(input.tipos_elementos_proibidos, "Ativos bloqueados", true), "Ativos",
    );
    const relief = this.object(input.relevo, "Relevo");
    if (relief) {
      this.number(relief, "altitude_minima_m", "Relevo", -Number.MAX_SAFE_INTEGER);
      this.number(relief, "altitude_maxima_m", "Relevo", -Number.MAX_SAFE_INTEGER);
      this.number(relief, "declividade_maxima_graus", "Relevo", 0, 90);
      if (typeof relief.altitude_minima_m === "number" && typeof relief.altitude_maxima_m === "number" && relief.altitude_minima_m > relief.altitude_maxima_m) {
        this.fail("A altitude mínima não pode ultrapassar a altitude máxima.");
      }
    }
    const vegetation = this.object(input.vegetacoes, "Vegetação");
    if (vegetation) this.disjoint(this.list(vegetation.permitidas, "Vegetação permitida"), this.list(vegetation.proibidas, "Vegetação proibida"), "Vegetação");
    for (const [label, value, fields] of [
      ["Edificações", input.edificacoes, ["raio_analise_m", "altura_maxima_m", "distancia_minima_m"]],
      ["Antenas", input.antenas, ["raio_analise_m", "distancia_maxima_m"]],
    ] as const) {
      const section = this.object(value, label);
      if (!section) continue;
      for (const field of fields) this.number(section, field, label, 0);
      this.number(section, "quantidade_maxima", label, 1, 2147483647, true);
      if (label === "Antenas" && section.considerar_conflito_frequencia != null && typeof section.considerar_conflito_frequencia !== "boolean") {
        this.fail("Antenas.considerar_conflito_frequencia deve ser booleano ou null.");
      }
    }
  }
}
