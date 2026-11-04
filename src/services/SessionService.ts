import { pool } from "../database/pool.js";

export class SessionService {
  async create(userId: string, tokenId: string, expiresAt: number): Promise<void> {
    await pool.query(`INSERT INTO sessoes_usuario (jti, id_usuario, expira_em)
      VALUES ($1, $2, to_timestamp($3))`, [tokenId, userId, expiresAt]);
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
