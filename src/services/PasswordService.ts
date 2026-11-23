import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = "scrypt$v1$32768$8$3";

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const key = await derive(password, salt);
    return `${prefix}$${salt}$${key.toString("hex")}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    const salt = parts[5];
    const key = parts[6];
    if (parts.length !== 7 || parts.slice(0, 5).join("$") !== prefix ||
        !salt || !/^[a-f0-9]{32}$/.test(salt) || !key || !/^[a-f0-9]{128}$/.test(key)) {
      // Equal-cost verification even for legacy/invalid hashes. Never accept plaintext.
      await derive(password, "0".repeat(32));
      return false;
    }
    return timingSafeEqual(await derive(password, salt), Buffer.from(key, "hex"));
  }
}
