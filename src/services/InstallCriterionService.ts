import { supabase } from "../database/supabase.js";
import type {
  CriterioInstalacao,
  CriarCriterioInstalacao,
} from "../interface/criterio-instalacao.js";
import { ValidationService } from "./ValidationService.js";


export class InstallCriterionService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  async createInstallCriterion(installData: CriarCriterioInstalacao) {
    await this.validationService.verifyRecord(
      "usuarios",
      "id_usuario",
      installData.id_usuario,
      "Usuário",
    );

    const criterio = {
      id_usuario: installData.id_usuario,
      nome: installData.nome.trim(),
      descricao: installData.descricao?.trim() || null,
      tipos_elementos_permitidos: installData.tipos_elementos_permitidos ?? null,
      tipos_elementos_proibidos: installData.tipos_elementos_proibidos ?? null,
      requer_alimentacao_eletrica: installData.requer_alimentacao_eletrica ?? null,
      altura_minima_m: installData.altura_minima_m ?? null,
      distancia_maxima_ativos_m: installData.distancia_maxima_ativos_m ?? null,
      caracteristicas_minimas_local:
        installData.caracteristicas_minimas_local ?? null,
      locais_autorizados: installData.locais_autorizados ?? null,
      locais_obrigatorios: installData.locais_obrigatorios ?? null,
      locais_proibidos: installData.locais_proibidos ?? null,
      limite_gateways: installData.limite_gateways ?? null,
      custo_maximo: installData.custo_maximo ?? null,
    };

    const { data, error } = await supabase.from("criterios_instalacao")
    .insert(criterio).select().single();

    if (error) throw new Error(`Erro ao criar critério de instalação: ${error.message}.`);
    return data as CriterioInstalacao;
  }
}
