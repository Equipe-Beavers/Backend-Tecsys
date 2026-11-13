import { Resend } from "resend";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

type EmailClient = Pick<Resend["emails"], "send">;
type GmailClient = {
  sendMail(message: { from: string; to: string; subject: string; text: string; messageId: string }): Promise<{
    messageId: string; accepted: unknown[]; rejected: unknown[];
  }>;
};

export class EmailDeliveryError extends Error {
  constructor(public readonly code: string) {
    super("Não foi possível enviar o e-mail.");
  }
}

export class EmailService {
  private readonly client?: EmailClient;
  private readonly gmail?: GmailClient;
  private readonly from: string;
  readonly provider: "gmail" | "resend";

  constructor(options: {
    client?: EmailClient;
    from?: string;
    wait?: (ms: number) => Promise<unknown>;
    gmailClient?: GmailClient;
    provider?: "gmail" | "resend";
  } = {}) {
    const gmailUser = process.env.GMAIL_USER?.trim().toLowerCase();
    const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    const provider = options.provider ?? process.env.EMAIL_PROVIDER?.trim()
      ?? (gmailUser || gmailPassword ? "gmail" : "resend");
    if (provider !== "gmail" && provider !== "resend") {
      throw new EmailDeliveryError("EMAIL_INVALID_PROVIDER");
    }
    this.provider = provider;
    this.wait = options.wait ?? setTimeout;
    if (provider === "gmail") {
      if (!gmailUser || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(gmailUser)
        || (!options.gmailClient && (!gmailPassword || gmailPassword.startsWith("<")))) {
        throw new EmailDeliveryError("EMAIL_NOT_CONFIGURED");
      }
      // Gmail must send from the authenticated mailbox, never from a stale Resend sender.
      this.from = `Geomash <${gmailUser}>`;
      this.gmail = options.gmailClient ?? nodemailer.createTransport({
        host: "smtp.gmail.com", port: 465, secure: true,
        auth: { user: gmailUser, pass: gmailPassword },
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
        dnsTimeout: 5_000, logger: false, debug: false,
        disableFileAccess: true, disableUrlAccess: true,
      });
      return;
    }
    const key = process.env.RESEND_API_KEY?.trim();
    const from = options.from ?? process.env.EMAIL_FROM?.trim();
    if ((!key && !options.client) || !from) {
      throw new EmailDeliveryError("EMAIL_NOT_CONFIGURED");
    }
    if (process.env.NODE_ENV === "production" && /@resend\.dev\b/i.test(from)) {
      throw new EmailDeliveryError("EMAIL_TEST_SENDER_IN_PRODUCTION");
    }
    this.client = options.client ?? new Resend(key).emails;
    this.from = from;
  }

  private readonly wait: (ms: number) => Promise<unknown>;

  /** Reuse the same opaque key for retries of one delivery; never use the reset token. */
  async sendText(message: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }): Promise<string> {
    const { idempotencyKey, ...content } = message;
    if (!idempotencyKey || idempotencyKey.length > 256) {
      throw new EmailDeliveryError("EMAIL_INVALID_IDEMPOTENCY_KEY");
    }
    if (this.gmail) {
      try {
        const messageId = `<geomash.${createHash("sha256").update(idempotencyKey).digest("hex")}@gmail.com>`;
        const result = await this.gmail.sendMail({ ...content, from: this.from, messageId });
        if (!result.messageId || !result.accepted.length || result.rejected.length) {
          throw new EmailDeliveryError("EMAIL_SEND_FAILED");
        }
        return result.messageId;
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        const code = (error as { code?: string })?.code;
        // SMTP has no idempotency guarantee; do not retry an ambiguous delivery automatically.
        throw new EmailDeliveryError(code === "EAUTH" ? "EMAIL_AUTH_FAILED"
          : ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "EDNS"].includes(code ?? "")
            ? "EMAIL_UNAVAILABLE" : "EMAIL_SEND_FAILED");
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await this.client!.send(
          { ...content, from: this.from },
          { idempotencyKey, signal: AbortSignal.timeout(15_000) },
        );
      } catch {
        if (attempt === 2) throw new EmailDeliveryError("EMAIL_UNAVAILABLE");
        await this.wait(500 * 2 ** attempt);
        continue;
      }
      const { data, error, headers } = response;
      if (!error && data?.id) return data.id;
      const status = error?.statusCode;
      const transient = status === 429 || (status != null && status >= 500)
        || error?.name === "application_error";
      if (!transient || attempt === 2) {
        throw new EmailDeliveryError("EMAIL_SEND_FAILED");
      }
      const retryAfter = headers?.["retry-after"];
      const delay = retryAfter
        ? (/^\d+(\.\d+)?$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now())
        : 500 * 2 ** attempt;
      // Do not retry earlier than the provider allows, or hold the request indefinitely.
      if (!Number.isFinite(delay) || delay > 30_000) {
        throw new EmailDeliveryError("EMAIL_UNAVAILABLE");
      }
      await this.wait(Math.max(0, delay));
    }
    throw new EmailDeliveryError("EMAIL_UNAVAILABLE");
  }
}
