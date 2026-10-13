import { pool } from "../database/pool.js";
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

  async createInstallCriterion(installData: CriarCriterioInstalacao): Promise<CriterioInstalacao> {
    await this.validationService.verifyRecord(
      "usuarios",
      "id_usuario",
      installData.id_usuario,
      "Usuário",
    );

    const criterio = [
      installData.id_usuario,
      installData.nome.trim(),
      installData.descricao?.trim() || null,
      installData.tipos_elementos_permitidos ?? null,
      installData.tipos_elementos_proibidos ?? null,
      installData.requer_alimentacao_eletrica ?? null,
      installData.altura_minima_m ?? null,
      installData.distancia_maxima_ativos_m ?? null,
      installData.caracteristicas_minimas_local ?? null,
      installData.locais_autorizados ?? null,
      installData.locais_obrigatorios ?? null,
      installData.locais_proibidos ?? null,
      installData.limite_gateways ?? null,
      installData.custo_maximo ?? null,
    ];

    const query = `
      INSERT INTO criterios_instalacao 
      (id_usuario, nome, descricao, tipos_elementos_permitidos, tipos_elementos_proibidos, requer_alimentacao_eletrica, altura_minima_m, distancia_maxima_ativos_m, caracteristicas_minimas_local, locais_autorizados, locais_obrigatorios, locais_proibidos, limite_gateways, custo_maximo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;
    `;

    const result = await pool.query(query, criterio);

    if (!result.rows[0]) throw new Error("Erro ao criar critério de instalação.");
    return result.rows[0] as CriterioInstalacao;
  }
}