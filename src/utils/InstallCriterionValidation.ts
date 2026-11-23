import { assetTypes } from "../interface/AssetType.js";
import type { CreateInstallCriterionDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "./InstallCriterionError.js";

export class InstallCriterionValidation {
  private fail(message: string): never {
    throw new InstallCriterionError(400, message);
  }

  private key(value: string): string {
    const key = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[\s-]+/g, "_");
    const aliases: Record<string, string> = { POSTES: "POSTE", SUBESTACOES: "SUBESTACAO" };
    return aliases[key] ?? key;
  }

  private object(value: unknown, label: string): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value)) this.fail(`${label} deve ser um objeto ou null.`);
    return value as Record<string, unknown>;
  }

  private list(value: unknown, label: string): string[] {
    if (value == null) return [];
    if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
      this.fail(`${label} deve ser uma lista de textos não vazios.`);
    }
    return (value as string[]).map(item => this.key(item));
  }

  private assets(value: unknown, label: string): string[] {
    const items = this.list(value, label);
    if (items.some(item => !assetTypes.some(type => type === item))) {
      this.fail(`${label}: selecione somente tipos de ativos elétricos disponíveis nas camadas.`);
    }
    return items;
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
    for (const field of ["distancia_minima_ativos_m", "distancia_maxima_ativos_m"] as const) {
      this.number(input as Record<string, unknown>, field, "Distância aos ativos", 10, 500);
    }
    if (input.distancia_minima_ativos_m != null && input.distancia_maxima_ativos_m != null
      && input.distancia_minima_ativos_m > input.distancia_maxima_ativos_m) {
      this.fail("A distância mínima não pode ultrapassar a distância máxima.");
    }
    this.disjoint(
      this.assets(input.tipos_elementos_permitidos, "Ativos permitidos"),
      this.assets(input.tipos_elementos_proibidos, "Ativos bloqueados"), "Ativos",
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
  }
}
