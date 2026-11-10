import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { App } from "../src/app.js";
import { PasswordResetService, resetReceipt } from "../src/services/PasswordResetService.js";
import { EmailService } from "../src/services/EmailService.js";
import { PasswordService } from "../src/services/PasswordService.js";
import { AuthError } from "../src/utils/AuthError.js";

const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: db }));
vi.mock("../src/database/supabase.js", () => ({ supabase: {} }));
const client = { query: vi.fn(), release: vi.fn() };
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  db.connect.mockResolvedValue(client);
  client.query.mockReset().mockResolvedValue({ rows: [] });
  db.query.mockReset().mockResolvedValue({ rows: [] });
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("EMAIL_FROM", "Geomash <onboarding@resend.dev>");
  vi.stubEnv("PASSWORD_RESET_URL", "http://localhost:8080/");
});
afterEach(() => vi.unstubAllEnvs());

describe("recuperação de senha", () => {
  it("sem URL configurada usa a página do backend e exige URL explícita em produção", async () => {
    vi.stubEnv("PASSWORD_RESET_URL", "");
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("NODE_ENV", "test");
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("SELECT id_usuario, email") ? [{ id_usuario: 7, email: "delivered@resend.dev" }] : [] }));
    const send = vi.spyOn(EmailService.prototype, "sendText").mockResolvedValue("mail-id");
    await new PasswordResetService().request("delivered@resend.dev");
    expect(send.mock.calls[0]![0].text).toMatch(/http:\/\/127\.0\.0\.1:3000\/redefinir-senha#token=[a-f0-9]{64}/);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_FROM", "Geomash <acesso@mail.example.com>");
    await expect(new PasswordResetService().request("missing@example.com")).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
  });

  it("persiste somente hash aleatório e envia link com expiração", async () => {
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("SELECT id_usuario, email") ? [{ id_usuario: 7, email: "delivered@resend.dev" }] : [] }));
    const send = vi.spyOn(EmailService.prototype, "sendText").mockResolvedValue("mail-id");
    await new PasswordResetService().request("DELIVERED@resend.dev");
    const content = send.mock.calls[0]![0];
    const token = new URL(content.text.match(/http[^\s]+/)![0]).hash.split("token=")[1]!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const insert = client.query.mock.calls.find(([sql]) => sql.startsWith("INSERT"))!;
    expect(insert[1]).toEqual([createHash("sha256").update(token).digest("hex"), 7]);
    expect(JSON.stringify(client.query.mock.calls)).not.toContain(token);
    expect(insert[0]).toContain("15 minutes");
    expect(content.idempotencyKey).not.toContain(token);
  });

  it("não envia para e-mail inexistente nem repete antes de um minuto", async () => {
    const send = vi.spyOn(EmailService.prototype, "sendText");
    await new PasswordResetService().request("missing@example.com");
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("SELECT id_usuario, email") ? [{ id_usuario: 7, email: "delivered@resend.dev" }] : sql.startsWith("SELECT 1") ? [{ exists: 1 }] : [] }));
    await new PasswordResetService().request("delivered@resend.dev");
    expect(send).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });

  it("rejeita links inválidos, expirados ou usados antes de calcular hash da senha", async () => {
    const passwords = new PasswordService();
    const hash = vi.spyOn(passwords, "hash");
    for (const token of ["inválido", "a".repeat(64)]) {
      await expect(new PasswordResetService(passwords).reset(token, "Nova senha segura!")).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
    }
    expect(hash).not.toHaveBeenCalled();
  });

  it("consome token, altera hash e revoga sessões na mesma transação", async () => {
    db.query.mockResolvedValue({ rows: [{ id_usuario: 7 }] });
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("RETURNING id_usuario") ? [{ id_usuario: 7 }] : [] }));
    const passwords = new PasswordService();
    vi.spyOn(passwords, "hash").mockResolvedValue("secure-hash");
    await new PasswordResetService(passwords).reset("a".repeat(64), "Nova senha segura!");
    const calls = client.query.mock.calls;
    expect(calls.find(([sql]) => sql.startsWith("UPDATE usuarios"))?.[1]).toEqual(["secure-hash", 7]);
    expect(calls.some(([sql]) => sql.startsWith("UPDATE sessoes_usuario"))).toBe(true);
    expect(calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("revalida token sob lock e desfaz tudo se já foi consumido", async () => {
    db.query.mockResolvedValue({ rows: [{ id_usuario: 7 }] });
    const passwords = new PasswordService(); vi.spyOn(passwords, "hash").mockResolvedValue("hash");
    await expect(new PasswordResetService(passwords).reset("a".repeat(64), "Nova senha segura!")).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE usuarios"))).toBe(false);
  });

  it("API é pública, normaliza e-mail, limita tentativas e não expõe existência", async () => {
    const request = vi.spyOn(PasswordResetService.prototype, "request").mockResolvedValue();
    const app = new App().getInstance();
    try {
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: " DELIVERED@resend.dev " } });
        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual({ message: resetReceipt });
        expect(response.headers["cache-control"]).toBe("no-store");
      }
      expect(request).toHaveBeenCalledWith("delivered@resend.dev");
      expect((await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "missing@example.com" } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it("API recusa confirmação/hash/ID extras, credenciais não textuais e links usados", async () => {
    const reset = vi.spyOn(PasswordResetService.prototype, "reset").mockRejectedValue(new AuthError(400, "INVALID_RESET_TOKEN", "Link inválido"));
    const app = new App().getInstance();
    try {
      for (const payload of [{ token: "a".repeat(64), senha: 12345678 }, { token: "a".repeat(64), senha: "segura senha", id_usuario: 1 }, { token: "a".repeat(64), senha: "curta" }]) {
        expect((await app.inject({ method: "POST", url: "/auth/reset-password", payload })).statusCode).toBe(400);
      }
      expect(reset).not.toHaveBeenCalled();
      const response = await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "a".repeat(64), senha: "Nova senha segura!" } });
      expect(response.json().code).toBe("INVALID_RESET_TOKEN");
    } finally { await app.close(); }
  });
});
