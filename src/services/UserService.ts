import { pool } from "../database/pool.js";
import type { CriarUsuario, Usuario } from "../interface/usuario.js";

export class UserService {
  async createUser(userData: CriarUsuario): Promise<Usuario> {
    const usuario = [
      userData.username.trim(),
      userData.email.trim(),
      userData.senha_hash,
    ];

    const query = `INSERT INTO usuarios (username, email, senha_hash) VALUES ($1, $2, $3) RETURNING *`;
    const result = await pool.query(query, usuario)

    if (!result.rows[0]) throw new Error("Não foi possível registrar o usuário no banco de dados.")
    return result.rows[0] as Usuario;
  }
}
