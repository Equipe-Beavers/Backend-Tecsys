import { pool } from "../database/pool.js";
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

    const cenario = [
      scenarioData.id_estudo,
      scenarioData.id_perfil_rf,
      scenarioData.id_criterio_instalacao ?? null,
      scenarioData.id_cenario_base ?? null,
      scenarioData.nome.trim(),
      scenarioData.descricao?.trim() || null,
      scenarioData.objetivo?.trim() || null,
      scenarioData.status,
      scenarioData.quantidade_gateways ?? null,
      scenarioData.pontos_interesse ?? null,
      scenarioData.pontos_cobertos ?? null,
      scenarioData.pontos_nao_cobertos ?? null,
      scenarioData.percentual_cobertura ?? null,
      scenarioData.capacidade_utilizada_media_pct ?? null,
      scenarioData.custo_total_estimado ?? null,
      scenarioData.mancha_consolidada ? JSON.stringify(scenarioData.mancha_consolidada) : null,
      scenarioData.executado_em ?? null,
    ];

    const query = `
      INSERT INTO cenarios
      (id_estudo, id_perfil_rf, id_criterio_instalacao, id_cenario_base, nome, descricao, objetivo, status, quantidade_gateways, pontos_interesse, pontos_cobertos, pontos_nao_cobertos, percentual_cobertura, capacidade_utilizada_media_pct, custo_total_estimado, mancha_consolidada, executado_em)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        CASE WHEN $16::text IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($16) END,
        $17
      ) RETURNING *;
    `;

    const result = await pool.query(query, cenario);

    if (!result.rows[0]) throw new Error("Erro ao criar cenário.");
    return result.rows[0] as Cenario;
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

    const atendimento = [
      scenarioData.id_cenario_gateway,
      scenarioData.id_estudo_ponto,
      scenarioData.distancia_m ?? null,
      scenarioData.nivel_sinal_estimado_dbm ?? null,
    ];

    const query = `
      INSERT INTO cenario_atendimentos
      (id_cenario_gateway, id_estudo_ponto, distancia_m, nivel_sinal_estimado_dbm)
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const result = await pool.query(query, atendimento);

    if (!result.rows[0]) throw new Error("Erro ao criar atendimento do cenário.");
    return result.rows[0] as CenarioAtendimento;
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

    const gateway = [
      scenarioData.id_cenario,
      scenarioData.id_estudo_ponto,
      scenarioData.ordem ?? null,
      scenarioData.quantidade_pontos_atendidos ?? null,
      scenarioData.capacidade_utilizada_pct ?? null,
      scenarioData.custo_estimado ?? null,
      scenarioData.parametros_calculo ?? null,
      scenarioData.mancha_cobertura ? JSON.stringify(scenarioData.mancha_cobertura) : null,
    ];

    const query = `
      INSERT INTO cenario_gateways
      (id_cenario, id_estudo_ponto, ordem, quantidade_pontos_atendidos, capacidade_utilizada_pct, custo_estimado, parametros_calculo, mancha_cobertura)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $8::text IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($8) END
      ) RETURNING *;
    `;

    const result = await pool.query(query, gateway);

    if (!result.rows[0]) throw new Error("Erro ao criar gateway do cenário.");
    return result.rows[0] as CenarioGateway;
  }
}
