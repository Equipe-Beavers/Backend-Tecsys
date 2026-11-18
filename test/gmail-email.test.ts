import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../src/services/EmailService.js";

const message = { to: "recipient@example.com", subject: "Teste", text: "Mensagem", idempotencyKey: "reset/attempt-id" };
beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "gmail");
  vi.stubEnv("GMAIL_USER", "sender@gmail.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  vi.stubEnv("EMAIL_FROM", "Geomash <onboarding@resend.dev>");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("envio Gmail", () => {
  it("usa SMTP com TLS, timeouts e senha de app; ignora remetente antigo do Resend", async () => {
    const create = vi.spyOn(nodemailer, "createTransport");
    const service = new EmailService();
    expect(service.provider).toBe("gmail");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: "sender@gmail.com", pass: "abcdefghijklmnop" },
      connectionTimeout: 10000, socketTimeout: 15000, logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true,
    }));
  });

  it("envia do endereço autenticado e retorna ID sem dados da conta", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "email-id", accepted: [message.to], rejected: [] });
    const service = new EmailService({ gmailClient: { sendMail } });
    expect(await service.sendText(message)).toBe("email-id");
    const sent = sendMail.mock.calls[0]![0];
    expect(sent.from).toBe("Geomash <sender@gmail.com>");
    expect(sent.to).toBe(message.to);
    expect(sent).not.toHaveProperty("idempotencyKey");
    expect(sent.messageId).not.toContain(message.idempotencyKey);
    expect(sent.messageId).toMatch(/^<geomash\.[a-f0-9]{64}@gmail.com>$/);
  });

  it.each(["EAUTH", "ETIMEDOUT", "EENVELOPE"])("trata %s sem vazar credenciais, repetir envio ou recorrer ao Resend", async code => {
    const sendMail = vi.fn().mockRejectedValue({ code, message: "private-credential" });
    const service = new EmailService({ gmailClient: { sendMail } });
    await expect(service.sendText(message)).rejects.toMatchObject({
      code: code === "EAUTH" ? "EMAIL_AUTH_FAILED" : code === "ETIMEDOUT" ? "EMAIL_UNAVAILABLE" : "EMAIL_SEND_FAILED",
      message: "Não foi possível enviar o e-mail.",
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("rejeita entrega sem destinatário aceito e chave de tentativa vazia", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "id", accepted: [], rejected: [message.to] });
    const service = new EmailService({ gmailClient: { sendMail } });
    await expect(service.sendText(message)).rejects.toMatchObject({ code: "EMAIL_SEND_FAILED" });
    await expect(service.sendText({ ...message, idempotencyKey: "" })).rejects.toMatchObject({ code: "EMAIL_INVALID_IDEMPOTENCY_KEY" });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("detecta Gmail sem seletor e não usa Resend quando a configuração Gmail está incompleta", () => {
    vi.stubEnv("EMAIL_PROVIDER", undefined);
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    expect(new EmailService().provider).toBe("gmail");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    expect(() => new EmailService()).toThrow(expect.objectContaining({ code: "EMAIL_NOT_CONFIGURED" }));
    vi.stubEnv("EMAIL_PROVIDER", "invalid");
    expect(() => new EmailService()).toThrow(expect.objectContaining({ code: "EMAIL_INVALID_PROVIDER" }));
  });
});
