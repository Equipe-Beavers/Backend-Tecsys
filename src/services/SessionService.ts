import { AuthError } from "../utils/AuthError.js";
import { pool } from "../database/pool.js";

export class SessionService {
  async create(userId: string, tokenId: string, expiresAt: number, verifiedHash?: string): Promise<void> {
    const result = await pool.query(`WITH usuario AS (
      SELECT id_usuario, senha_hash FROM usuarios WHERE id_usuario = $2 FOR UPDATE
    ) INSERT INTO sessoes_usuario (jti, id_usuario, expira_em)
      SELECT $1, id_usuario, to_timestamp($3) FROM usuario
      WHERE ($4::text IS NULL OR senha_hash = $4)`, [tokenId, userId, expiresAt, verifiedHash ?? null]);
    if (result.rowCount === 0) {
      throw new AuthError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    }
  }

  async isActive(userId: string, tokenId: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM sessoes_usuario s
      JOIN usuarios u ON u.id_usuario = s.id_usuario
      WHERE s.jti = $1 AND s.id_usuario = $2
        AND s.revogada_em IS NULL AND s.expira_em > CURRENT_TIMESTAMP`, [tokenId, userId]);
    return rows.length > 0;
  }

  async revoke(userId: string, tokenId: string): Promise<void> {
    await pool.query(`UPDATE sessoes_usuario SET revogada_em = CURRENT_TIMESTAMP
      WHERE jti = $1 AND id_usuario = $2 AND revogada_em IS NULL`, [tokenId, userId]);
  }
}
