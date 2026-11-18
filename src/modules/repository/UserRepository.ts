import { pool } from "../../database/pool.js";
import type { Usuario } from "../../interface/usuario.js";

export class UserRepository {
  async findDuplicates(username: string, email: string): Promise<Pick<Usuario, "username" | "email">[]> {
    const result = await pool.query(
      `SELECT username, email FROM usuarios
       WHERE lower(btrim(username)) = lower($1) OR lower(btrim(email)) = $2`,
      [username, email],
    );
    return result.rows;
  }

  async create(username: string, email: string, passwordHash: string): Promise<Usuario> {
    const result = await pool.query(
      `INSERT INTO usuarios (username, email, senha_hash) VALUES ($1, $2, $3)
       RETURNING id_usuario, username, email, criado_em, atualizado_em`,
      [username, email, passwordHash],
    );
    if (!result.rows[0]) throw new Error("User insert did not return a record");
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<Usuario | undefined> {
    const result = await pool.query(
      `SELECT id_usuario, username, email, senha_hash, criado_em, atualizado_em
       FROM usuarios WHERE lower(btrim(email)) = $1`, [email],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Usuario | undefined> {
    const result = await pool.query(
      `SELECT id_usuario, username, email, criado_em, atualizado_em
       FROM usuarios WHERE id_usuario = $1`, [id],
    );
    return result.rows[0];
  }
}
