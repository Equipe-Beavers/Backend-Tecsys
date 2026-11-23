import { pool } from "../database/pool.js";
import { AuthError } from "../utils/AuthError.js";

const resources = {
  study: "SELECT id_estudo FROM estudos WHERE id_estudo = $1 AND id_usuario = $2",
  profile: "SELECT id_perfil_rf FROM perfis_rf WHERE id_perfil_rf = $1 AND id_usuario = $2",
  criterion: "SELECT id_criterio_instalacao FROM criterios_instalacao WHERE id_criterio_instalacao = $1 AND id_usuario = $2",
  scenario: `SELECT c.id_estudo FROM cenarios c JOIN estudos e ON e.id_estudo = c.id_estudo
    WHERE c.id_cenario = $1 AND e.id_usuario = $2`,
  point: `SELECT p.id_estudo FROM estudo_pontos p JOIN estudos e ON e.id_estudo = p.id_estudo
    WHERE p.id_estudo_ponto = $1 AND e.id_usuario = $2`,
  gateway: `SELECT c.id_estudo FROM cenario_gateways g JOIN cenarios c ON c.id_cenario = g.id_cenario
    JOIN estudos e ON e.id_estudo = c.id_estudo WHERE g.id_cenario_gateway = $1 AND e.id_usuario = $2`,
};

export class OwnershipService {
  async require(resource: keyof typeof resources, id: unknown, userId: number): Promise<{ id_estudo?: number }> {
    if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
      throw new AuthError(400, "INVALID_RESOURCE_ID", "Identificador de recurso inválido.");
    }
    const { rows } = await pool.query(resources[resource], [Number(id), userId]);
    if (!rows[0]) throw new AuthError(404, "RESOURCE_NOT_FOUND", "Recurso não encontrado.");
    return rows[0];
  }
}
