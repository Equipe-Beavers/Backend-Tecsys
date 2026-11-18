import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { startAndroidUsb } from "./android-usb.mjs";

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "src/server.ts"], { stdio: "inherit" });
const stops = [];
if (process.env.ANDROID_USB_AUTOCONNECT !== "false") {
  stops.push(await startAndroidUsb({ port: Number(process.env.PORT ?? 3000) }));
  // The reset link opens Flutter web on the phone's browser through USB.
  try {
    const resetUrl = new URL(process.env.PASSWORD_RESET_URL || "http://127.0.0.1:8080/");
    if (["localhost", "127.0.0.1"].includes(resetUrl.hostname)) {
      const port = Number(resetUrl.port || (resetUrl.protocol === "https:" ? 443 : 80));
      if (port !== Number(process.env.PORT ?? 3000)) {
        stops.push(await startAndroidUsb({ port, label: "frontend web" }));
      }
    }
  } catch {
    console.warn("[USB] PASSWORD_RESET_URL inválida; encaminhamento do frontend indisponível.");
  }
}
const stopUsb = () => stops.forEach(stop => stop());
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopping = true; stopUsb(); child.kill(signal);
  });
}
child.once("error", () => { stopUsb(); console.error("Não foi possível iniciar o backend."); process.exitCode = 1; });
child.once("exit", code => { stopUsb(); process.exitCode = stopping ? 0 : (code ?? 1); });
