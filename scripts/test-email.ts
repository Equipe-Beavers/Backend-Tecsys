import "dotenv/config";
import { randomUUID } from "node:crypto";
import { EmailDeliveryError, EmailService } from "../src/services/EmailService.js";

const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error("Uso: npm run email:test -- email-da-conta-resend");
  process.exitCode = 1;
} else {
  try {
    const emailId = await new EmailService().sendText({
      to: recipient,
      subject: "Geomash — teste de envio de e-mail",
      text: "A integração do Geomash com o Resend enviou esta mensagem de teste.\nEsta mensagem não altera sua conta nem sua senha.",
      idempotencyKey: `setup-test/${randomUUID()}`,
    });
    console.log(JSON.stringify({ accepted: true, emailId }));
  } catch (error) {
    console.error(error instanceof EmailDeliveryError ? error.code : "EMAIL_TEST_FAILED");
    process.exitCode = 1;
  }
}
