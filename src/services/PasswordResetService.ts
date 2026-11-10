import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool } from "../database/pool.js";
import { PasswordService } from "./PasswordService.js";
import { EmailService } from "./EmailService.js";
import { AuthError } from "../utils/AuthError.js";

export const resetReceipt = "Se houver uma conta com esse e-mail, enviaremos as instruções para redefinir a senha.";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidLink = () => new AuthError(400, "INVALID_RESET_TOKEN", "Este link é inválido, expirou ou já foi utilizado. Solicite outro link.");

export class PasswordResetService {
  constructor(private readonly passwords = new PasswordService()) {}

  async request(email: string): Promise<void> {
    // Validate configuration for every address, including addresses without an account.
    const mail = new EmailService();
    let base: URL;
    try {
      const configured = process.env.PASSWORD_RESET_URL?.trim();
      if (!configured && process.env.NODE_ENV === "production") throw new Error();
      base = new URL(configured || `http://127.0.0.1:${process.env.PORT || 3000}/redefinir-senha`);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
        || (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error();
    } catch {
      throw new AuthError(503, "EMAIL_NOT_CONFIGURED", "Recuperação de senha temporariamente indisponível.");
    }
    const token = randomBytes(32).toString("hex");
    const tokenHash = digest(token);
    const client = await pool.connect();
    let recipient: string | undefined;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT id_usuario, email FROM usuarios WHERE lower(btrim(email)) = $1 FOR UPDATE", [email.trim().toLowerCase()]);
      const user = rows[0];
      if (user) {
        const recent = await client.query(`SELECT 1 FROM recuperacoes_senha WHERE id_usuario = $1
          AND criado_em > CURRENT_TIMESTAMP - INTERVAL '1 minute' LIMIT 1`, [user.id_usuario]);
        if (!recent.rows.length) {
          await client.query("DELETE FROM recuperacoes_senha WHERE id_usuario = $1", [user.id_usuario]);
          await client.query(`INSERT INTO recuperacoes_senha (token_hash, id_usuario, expira_em)
            VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`, [tokenHash, user.id_usuario]);
          recipient = user.email;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    if (!recipient) return;
    // The default standalone page needs only the backend; explicit Flutter URLs remain supported.
    base.hash = base.pathname.replace(/\/$/, "") === "/redefinir-senha"
      ? `token=${token}` : `/redefinir-senha?token=${token}`;
    try {
      const emailId = await mail.sendText({ to: recipient, subject: "Geomash — redefinir sua senha",
        text: `Recebemos uma solicitação para redefinir sua senha no Geomash.\n\nAbra o link abaixo e escolha uma nova senha:\n${base.href}\n\nO link expira em 15 minutos e só pode ser utilizado uma vez.\nSe você não solicitou a alteração, ignore esta mensagem. Sua senha permanece a mesma.`,
        idempotencyKey: `password-reset/${randomUUID()}` });
      console.info(JSON.stringify({ event: "password-reset-email-accepted", emailId }));
    } catch {
      // A delivery failure must not reveal whether the address belongs to an account.
      await pool.query("UPDATE recuperacoes_senha SET usado_em = CURRENT_TIMESTAMP WHERE token_hash = $1", [tokenHash]);
      console.error("PASSWORD_RESET_EMAIL_FAILED");
    }
  }

  async reset(token: string, password: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw invalidLink();
    if (password.length < 8 || password.length > 128 || !password.trim()) {
      throw new AuthError(400, "INVALID_PASSWORD", "A senha deve ter entre 8 e 128 caracteres.");
    }
    const tokenHash = digest(token);
    // Avoid expensive password hashing for random/expired links.
    const candidate = await pool.query(`SELECT id_usuario FROM recuperacoes_senha
      WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > CURRENT_TIMESTAMP`, [tokenHash]);
    if (!candidate.rows[0]) throw invalidLink();
    const hash = await this.passwords.hash(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const id = candidate.rows[0].id_usuario;
      await client.query("SELECT id_usuario FROM usuarios WHERE id_usuario = $1 FOR UPDATE", [id]);
      const consumed = await client.query(`UPDATE recuperacoes_senha SET usado_em = clock_timestamp()
        WHERE token_hash = $1 AND id_usuario = $2 AND usado_em IS NULL
          AND expira_em > clock_timestamp() RETURNING id_usuario`, [tokenHash, id]);
      if (!consumed.rows.length) throw invalidLink();
      await client.query("UPDATE usuarios SET senha_hash = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id_usuario = $2", [hash, id]);
      await client.query("UPDATE sessoes_usuario SET revogada_em = CURRENT_TIMESTAMP WHERE id_usuario = $1 AND revogada_em IS NULL", [id]);
      await client.query("UPDATE recuperacoes_senha SET usado_em = CURRENT_TIMESTAMP WHERE id_usuario = $1 AND usado_em IS NULL", [id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
