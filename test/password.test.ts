import { describe, expect, it } from "vitest";
import { PasswordService } from "../src/services/PasswordService.js";

describe("hash de senhas", () => {
  it("usa salts independentes e preserva espaços e caracteres Unicode da senha", async () => {
    const service = new PasswordService();
    const password = "  senha com acentuação 🔐  ";
    const first = await service.hash(password);
    const second = await service.hash(password);
    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(255);
    expect(await service.verify(password, first)).toBe(true);
    expect(await service.verify(password.trim(), first)).toBe(false);
  });

  it.each(["", "senha em texto", "scrypt$v1$999999999$8$3$a$b"])("rejeita hash inválido sem aceitar texto puro: %s", async (stored) => {
    expect(await new PasswordService().verify("senha em texto", stored)).toBe(false);
  });
});
