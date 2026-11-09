import { Resend } from "resend";
import { setTimeout } from "node:timers/promises";

type EmailClient = Pick<Resend["emails"], "send">;

export class EmailDeliveryError extends Error {
  constructor(public readonly code: string) {
    super("Não foi possível enviar o e-mail.");
  }
}

export class EmailService {
  private readonly client: EmailClient;
  private readonly from: string;

  constructor(options: {
    client?: EmailClient;
    from?: string;
    wait?: (ms: number) => Promise<unknown>;
  } = {}) {
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
    this.wait = options.wait ?? setTimeout;
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
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await this.client.send(
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
