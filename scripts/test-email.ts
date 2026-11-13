import "dotenv/config";
import { randomUUID } from "node:crypto";
import { EmailDeliveryError, EmailService } from "../src/services/EmailService.js";

const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error("Uso: npm run email:test -- email-destinatario");
  process.exitCode = 1;
} else {
  try {
    const service = new EmailService();
    const emailId = await service.sendText({
      to: recipient,
      subject: "Geomash — teste de envio de e-mail",
      text: "O Geomash enviou esta mensagem para testar o serviço de e-mail.\nEsta mensagem não altera sua conta nem sua senha.",
      idempotencyKey: `setup-test/${randomUUID()}`,
    });
    console.log(JSON.stringify({ accepted: true, provider: service.provider, emailId }));
  } catch (error) {
    console.error(error instanceof EmailDeliveryError ? error.code : "EMAIL_TEST_FAILED");
    process.exitCode = 1;
  }
}
