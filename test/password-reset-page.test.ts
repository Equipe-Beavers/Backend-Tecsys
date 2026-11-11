import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { Script, createContext } from "node:vm";
import { registerPasswordResetPage } from "../src/views/password-reset.js";

describe("página pública de redefinição no próprio backend", () => {
  it("confirma senhas, envia token por POST e trata sucesso e expiração", async () => {
    const app = Fastify(); registerPasswordResetPage(app);
    try {
      const html = (await app.inject("/redefinir-senha")).body;
      const source = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1]!;
      const token = "a".repeat(64);
      const execute = (status: number, rawToken = token) => {
        const elements = Object.fromEntries(["form", "notice", "password", "confirmation", "submit", "toggle", "intro", "instructions", "loading", "main"].map(id => [id, {
          value: "Senha nova segura!", type: "password", hidden: false, disabled: false,
          textContent: "", className: "", validity: "", listeners: {} as Record<string, (event?: unknown) => Promise<void>>,
          addEventListener(name: string, fn: (event?: unknown) => Promise<void>) { this.listeners[name] = fn; },
          setCustomValidity(value: string) { this.validity = value; }, reportValidity() {}, setAttribute() {}, reset() {},
        }]));
        const calls: { url: string; body: { token: string; senha: string } }[] = [];
        new Script(source).runInContext(createContext({
          document: { getElementById: (id: string) => elements[id], querySelector: () => elements.main },
          location: { hash: `#token=${rawToken}`, pathname: "/redefinir-senha" },
          history: { replaceState() {} }, URLSearchParams, AbortSignal,
          fetch: async (url: string, options: { body: string }) => {
            calls.push({ url, body: JSON.parse(options.body) });
            if (status === 0) throw new Error("network unavailable");
            return { status, json: async () => ({ code: "INVALID_RESET_TOKEN" }) };
          },
        }));
        return { elements, calls, submit: () => elements.form!.listeners.submit!({ preventDefault() {} }) };
      };
      const success = execute(204);
      success.elements.confirmation!.value = "Diferente";
      await success.submit();
      expect(success.calls).toHaveLength(0);
      expect(success.elements.confirmation!.validity).toContain("não coincidem");
      success.elements.confirmation!.value = success.elements.password!.value;
      const submitted = success.submit();
      expect(success.elements.loading!.hidden).toBe(false);
      expect(success.elements.main!.hidden).toBe(true);
      await submitted;
      expect(success.elements.loading!.hidden).toBe(true);
      expect(success.elements.main!.hidden).toBe(false);
      expect(success.calls).toEqual([{ url: "/auth/reset-password", body: { token, senha: "Senha nova segura!" } }]);
      expect(success.elements.form!.hidden).toBe(true);
      expect(success.elements.notice!.textContent).toContain("Senha alterada com sucesso");
      const expired = execute(400); await expired.submit();
      expect(expired.elements.notice!.textContent).toContain("expirou");
      expect(expired.elements.loading!.hidden).toBe(true);
      const network = execute(0); await network.submit();
      expect(network.elements.loading!.hidden).toBe(true);
      expect(network.elements.main!.hidden).toBe(false);
      expect(network.elements.notice!.textContent).toContain("conectar ao servidor");
      const invalid = execute(400, "invalid");
      expect(invalid.elements.form!.hidden).toBe(true);
      expect(invalid.calls).toHaveLength(0);
    } finally { await app.close(); }
  });

  it("funciona sem Flutter web, usa nonce por resposta e não recebe token na URL HTTP", async () => {
    const app = Fastify(); registerPasswordResetPage(app);
    try {
      const first = await app.inject("/redefinir-senha");
      const second = await app.inject("/redefinir-senha");
      expect(first.statusCode).toBe(200);
      expect(first.headers["content-type"]).toContain("text/html");
      expect(first.headers["cache-control"]).toBe("no-store");
      expect(first.headers["referrer-policy"]).toBe("no-referrer");
      const policy = first.headers["content-security-policy"] as string;
      expect(policy).toContain("frame-ancestors 'none'");
      const nonce = policy.match(/script-src 'nonce-([^']+)'/)![1];
      expect(first.body).toContain(`<script nonce="${nonce}">`);
      expect(first.body).not.toBe(second.body);
      expect(first.body).toContain("location.hash");
      expect(first.body).toContain("history.replaceState");
      expect(first.body).toContain("fetch('/auth/reset-password'");
      const script = first.body.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1]!;
      expect(() => new Script(script)).not.toThrow();
    } finally { await app.close(); }
  });
});
