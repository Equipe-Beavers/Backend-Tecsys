import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { startAndroidUsb } from "./android-usb.mjs";

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "src/server.ts"], { stdio: "inherit" });
const stopUsb = process.env.ANDROID_USB_AUTOCONNECT === "false"
  ? () => {} : await startAndroidUsb({ port: Number(process.env.PORT ?? 3000) });
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopping = true; stopUsb(); child.kill(signal);
  });
}
child.once("error", () => { stopUsb(); console.error("Não foi possível iniciar o backend."); process.exitCode = 1; });
child.once("exit", code => { stopUsb(); process.exitCode = stopping ? 0 : (code ?? 1); });
