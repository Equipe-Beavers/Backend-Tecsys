import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const exec = promisify(execFile);

export async function findAdb(environment = process.env) {
  const file = process.platform === "win32" ? "adb.exe" : "adb";
  const roots = [environment.ANDROID_SDK_ROOT, environment.ANDROID_HOME,
    join(homedir(), "Android", "Sdk"), join(homedir(), "Library", "Android", "sdk"),
    environment.LOCALAPPDATA && join(environment.LOCALAPPDATA, "Android", "Sdk")].filter(Boolean);
  const candidates = [environment.ADB_PATH, ...roots.map(root => join(root, "platform-tools", file)),
    ...(environment.PATH ?? "").split(delimiter).filter(Boolean).map(dir => join(dir, file))].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* Try next SDK. */ }
  }
}

export function parseDevices(output) {
  return output.split(/\r?\n/).filter(line => /^\S+\s+device(?:\s|$)/.test(line))
    .map(line => line.trim().split(/\s+/)[0]);
}

/** Development only. Rechecks mappings so USB reconnections need no manual command. */
export async function startAndroidUsb({ port = 3000, label = "backend", log = console.log, run = exec, adb } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid backend port");
  adb ??= await findAdb();
  if (!adb) {
    log("[USB] ADB não encontrado. Desktop disponível; para Android, configure ANDROID_SDK_ROOT e reinicie npm run dev.");
    return () => {};
  }
  log(`[USB] Acesso automático na porta ${port}; conecte o Android e autorize a depuração USB.`);
  let stopped = false, busy = false, warned = false;
  const connected = new Set();
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const { stdout } = await run(adb, ["devices", "-l"], { timeout: 5000 });
      if (stopped) return;
      const devices = parseDevices(stdout);
      for (const id of connected) if (!devices.includes(id)) connected.delete(id);
      for (const id of devices) {
        const { stdout: mappings } = await run(adb, ["-s", id, "reverse", "--list"], { timeout: 5000 });
        const expected = `tcp:${port}`;
        const mapped = mappings.split(/\r?\n/).some(line => {
          const fields = line.trim().split(/\s+/); return fields.at(-2) === expected && fields.at(-1) === expected;
        });
        if (!mapped) await run(adb, ["-s", id, "reverse", expected, expected], { timeout: 5000 });
        if (!connected.has(id) || !mapped) log(`[USB] Android conectado ao ${label} em http://127.0.0.1:${port}`);
        connected.add(id);
      }
      warned = false;
    } catch {
      if (!warned) log("[USB] Não foi possível configurar o Android. Confira o cabo e autorize a depuração USB; tentaremos novamente.");
      warned = true;
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 3000);
  timer.unref();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
