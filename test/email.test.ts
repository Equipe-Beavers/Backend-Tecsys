import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailService } from "../src/services/EmailService.js";

beforeEach(() => vi.stubEnv("EMAIL_PROVIDER", "resend"));
afterEach(() => vi.unstubAllEnvs());

describe("envio Resend", () => {
  const message = {
    to: "delivered@resend.dev", subject: "Teste", text: "Teste",
    idempotencyKey: "setup-test/unique-attempt",
  };
  const success = { data: { id: "email-id" }, error: null, headers: {} };
  const setup = () => {
    const send = vi.fn().mockResolvedValue(success);
    const wait = vi.fn().mockResolvedValue(undefined);
    const service = new EmailService({ client: { send }, from: "Geomash <onboarding@resend.dev>", wait });
    return { send, wait, service };
  };

  it("retorna ID e envia chave de idempotência separada do conteúdo", async () => {
    const { send, service } = setup();
    expect(await service.sendText(message)).toBe("email-id");
    expect(send).toHaveBeenCalledWith(
      { to: message.to, subject: "Teste", text: "Teste", from: "Geomash <onboarding@resend.dev>" },
      { idempotencyKey: message.idempotencyKey, signal: expect.any(AbortSignal) },
    );
  });

  it("recusa configuração ausente e remetente de teste em produção", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(() => new EmailService()).toThrow(expect.objectContaining({ code: "EMAIL_NOT_CONFIGURED" }));
    vi.stubEnv("NODE_ENV", "production");
    expect(setup).toThrow(expect.objectContaining({ code: "EMAIL_TEST_SENDER_IN_PRODUCTION" }));
  });

  it("não repete erros de credenciais nem expõe mensagem do provedor", async () => {
    const { send, service } = setup();
    send.mockResolvedValue({ data: null, error: { statusCode: 403, name: "invalid_api_key", message: "detalhes privados" }, headers: {} });
    await expect(service.sendText(message)).rejects.toThrow(expect.objectContaining({ code: "EMAIL_SEND_FAILED", message: "Não foi possível enviar o e-mail." }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("respeita retry-after no 429 e reutiliza a mesma chave", async () => {
    const { send, wait, service } = setup();
    send.mockResolvedValueOnce({ data: null, error: { statusCode: 429 }, headers: { "retry-after": "2" } });
    await service.sendText(message);
    expect(wait).toHaveBeenCalledWith(2000);
    expect(send).toHaveBeenCalledTimes(2);
    for (const call of send.mock.calls) expect(call[1].idempotencyKey).toBe(message.idempotencyKey);
  });

  it("limita as tentativas de falha de rede", async () => {
    const { send, service } = setup();
    send.mockRejectedValue(new Error("rede"));
    await expect(service.sendText(message)).rejects.toThrow(expect.objectContaining({ code: "EMAIL_UNAVAILABLE" }));
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("repete 503 e não repete uma resposta inválida de sucesso", async () => {
    const { send, service } = setup();
    send.mockResolvedValueOnce({ data: null, error: { statusCode: 503 }, headers: {} });
    expect(await service.sendText(message)).toBe("email-id");
    send.mockClear().mockResolvedValue({ data: null, error: null, headers: {} });
    await expect(service.sendText(message)).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("não ignora retry-after longo e recusa chave vazia", async () => {
    const { send, wait, service } = setup();
    send.mockResolvedValue({ data: null, error: { statusCode: 429 }, headers: { "retry-after": "120" } });
    await expect(service.sendText(message)).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    await expect(service.sendText({ ...message, idempotencyKey: "" })).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
