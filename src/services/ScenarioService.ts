import { supabase } from "../database/supabase.js";
import type {
  CenarioAtendimento,
  CriarCenarioAtendimento,
} from "../interface/cenario-atendimento.js";
import type {
  CenarioGateway,
  CriarCenarioGateway,
} from "../interface/cenario-gateway.js";
import type { Cenario, CriarCenario } from "../interface/cenario.js";
import { ValidationService } from "./ValidationService.js";

export class ScenarioService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  async createScenario(scenarioData: CriarCenario): Promise<Cenario> {
    await this.validationService.verifyRecord(
      "estudos",
      "id_estudo",
      scenarioData.id_estudo,
      "Estudo",
    );
    await this.validationService.verifyRecord(
      "perfis_rf",
      "id_perfil_rf",
      scenarioData.id_perfil_rf,
      "Perfil RF",
    );

    if (scenarioData.id_criterio_instalacao) {
      await this.validationService.verifyRecord(
        "criterios_instalacao",
        "id_criterio_instalacao",
        scenarioData.id_criterio_instalacao,
        "Critério de instalação",
      );
    }
    if (scenarioData.id_cenario_base) {
      await this.validationService.verifyRecord(
        "cenarios",
        "id_cenario",
        scenarioData.id_cenario_base,
        "Cenário base",
      );
    }

    const cenario = {
      id_estudo: scenarioData.id_estudo,
      id_perfil_rf: scenarioData.id_perfil_rf,
      id_criterio_instalacao: scenarioData.id_criterio_instalacao ?? null,
      id_cenario_base: scenarioData.id_cenario_base ?? null,
      nome: scenarioData.nome.trim(),
      descricao: scenarioData.descricao?.trim() || null,
      objetivo: scenarioData.objetivo?.trim() || null,
      status: scenarioData.status,
      quantidade_gateways: scenarioData.quantidade_gateways ?? null,
      pontos_interesse: scenarioData.pontos_interesse ?? null,
      pontos_cobertos: scenarioData.pontos_cobertos ?? null,
      pontos_nao_cobertos: scenarioData.pontos_nao_cobertos ?? null,
      percentual_cobertura: scenarioData.percentual_cobertura ?? null,
      capacidade_utilizada_media_pct: scenarioData.capacidade_utilizada_media_pct ?? null,
      custo_total_estimado: scenarioData.custo_total_estimado ?? null,
      mancha_consolidada: scenarioData.mancha_consolidada ?? null,
      executado_em: scenarioData.executado_em ?? null,
    };

    const { data, error } = await supabase.from("cenarios")
    .insert(cenario).select().single();

    if (error) throw new Error(`Erro ao criar cenário: ${error.message}.`);
    return data as Cenario;
  }

  async createServiceScenario(
    scenarioData: CriarCenarioAtendimento,
  ): Promise<CenarioAtendimento> {
    await this.validationService.verifyRecord(
      "cenario_gateways",
      "id_cenario_gateway",
      scenarioData.id_cenario_gateway,
      "Gatewau do cenário",
    );
    await this.validationService.verifyRecord(
      "estudo_pontos",
      "id_estudo_ponto",
      scenarioData.id_estudo_ponto,
      "Ponto do estudo",
    );

    const atendimento = {
      id_cenario_gateway: scenarioData.id_cenario_gateway,
      id_estudo_ponto: scenarioData.id_estudo_ponto,
      distancia_m: scenarioData.distancia_m ?? null,
      nivel_sinal_estimado_dbm: scenarioData.nivel_sinal_estimado_dbm ?? null,
    };

    const { data, error } = await supabase
      .from("cenario_atendimentos")
      .insert(atendimento)
      .select()
      .single();

    if (error)
      throw new Error(
        `Erro ao criar atendimento do cenário: ${error.message}.`,
      );
    return data as CenarioAtendimento;
  }

  async createGatewayScenario(
    scenarioData: CriarCenarioGateway,
  ): Promise<CenarioGateway> {
    await this.validationService.verifyRecord(
      "cenarios",
      "id_cenario",
      scenarioData.id_cenario,
      "Cenário",
    );
    await this.validationService.verifyRecord(
      "estudo_pontos",
      "id_estudo_ponto",
      scenarioData.id_estudo_ponto,
      "Ponto do estudo",
    );

    const gateway = {
      id_cenario: scenarioData.id_cenario,
      id_estudo_ponto: scenarioData.id_estudo_ponto,
      ordem: scenarioData.ordem ?? null,
      quantidade_pontos_atendidos:
        scenarioData.quantidade_pontos_atendidos ?? null,
      capacidade_utilizada_pct: scenarioData.capacidade_utilizada_pct ?? null,
      custo_estimado: scenarioData.custo_estimado ?? null,
      parametros_calculo: scenarioData.parametros_calculo ?? null,
      mancha_cobertura: scenarioData.mancha_cobertura ?? null,
    };

    const { data, error } = await supabase
      .from("cenario_gateways")
      .insert(gateway)
      .select()
      .single();

    if (error)
      throw new Error(`Erro ao criar gateway do cenário: ${error.message}`);
    return data as CenarioGateway;
  }
}
