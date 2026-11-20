import type { CriarUsuario, LoginUsuario, Usuario, UsuarioPublico } from "../interface/usuario.js";
import { UserRepository } from "../modules/repository/UserRepository.js";
import { PasswordService } from "./PasswordService.js";
import { AuthError } from "../utils/AuthError.js";

export function publicUser(user: Usuario): UsuarioPublico {
  const id = Number(user.id_usuario);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid user identifier");
  return {
    id_usuario: id, username: user.username, email: user.email,
    criado_em: user.criado_em, atualizado_em: user.atualizado_em,
  };
}

function emailValue(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError(400, "INVALID_EMAIL", "Informe um e-mail válido.");
  }
  return email;
}

export class UserService {
  constructor(
    private readonly repository = new UserRepository(),
    private readonly passwords = new PasswordService(),
  ) {}

  async createUser(input: CriarUsuario): Promise<UsuarioPublico> {
    const username = input.username.normalize("NFKC").trim();
    const email = emailValue(input.email);
    if (username.length < 3 || username.length > 100 || /[\u0000-\u001f\u007f]/.test(username)) {
      throw new AuthError(400, "INVALID_USERNAME", "O nome de usuário deve ter entre 3 e 100 caracteres.");
    }
    if (input.senha.length < 8 || input.senha.length > 128 || !input.senha.trim()) {
      throw new AuthError(400, "INVALID_PASSWORD", "A senha deve ter entre 8 e 128 caracteres.");
    }
    const duplicates = await this.repository.findDuplicates(username, email);
    if (duplicates.some((user) => user.email.trim().toLowerCase() === email)) {
      throw new AuthError(409, "EMAIL_ALREADY_EXISTS", "E-mail já cadastrado.");
    }
    if (duplicates.length) {
      throw new AuthError(409, "USERNAME_ALREADY_EXISTS", "Nome de usuário já cadastrado.");
    }
    const hash = await this.passwords.hash(input.senha);
    try {
      return publicUser(await this.repository.create(username, email, hash));
    } catch (error) {
      const pg = error as { code?: string; constraint?: string };
      if (pg.code === "23505") {
        const emailConflict = pg.constraint?.includes("email");
        throw new AuthError(409, emailConflict ? "EMAIL_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS",
          emailConflict ? "E-mail já cadastrado." : "Nome de usuário já cadastrado.");
      }
      throw error;
    }
  }

  async authenticate(input: LoginUsuario, verified?: (hash: string) => void): Promise<UsuarioPublico> {
    const email = emailValue(input.email);
    const user = await this.repository.findByEmail(email);
    const valid = await this.passwords.verify(input.senha, user?.senha_hash ?? "");
    if (!user || !valid) throw new AuthError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    verified?.(user.senha_hash);
    return publicUser(user);
  }

  async findAuthenticated(id: string): Promise<UsuarioPublico> {
    const user = await this.repository.findById(id);
    if (!user) throw new AuthError(401, "INVALID_TOKEN", "Sessão inválida. Entre novamente.");
    return publicUser(user);
  }
}
