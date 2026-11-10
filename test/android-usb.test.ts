import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Development helper is an independent Node ESM script.
import { parseDevices, startAndroidUsb } from "../scripts/android-usb.mjs";

describe("acesso USB automático em desenvolvimento", () => {
  it("ignora aparelhos não autorizados e preserva múltiplos dispositivos", () => {
    expect(parseDevices("List of devices attached\nphone device usb:1\nemulator-5554 device\nblocked unauthorized\noff offline\n")).toEqual(["phone", "emulator-5554"]);
  });

  it("configura a porta, repara um mapeamento removido e para ao encerrar", async () => {
    vi.useFakeTimers();
    let mapped = false;
    const run = vi.fn(async (_file: string, args: string[]) => {
      if (args[0] === "devices") return { stdout: "phone device usb:1\n" };
      if (args.includes("--list")) return { stdout: mapped ? "UsbFfs tcp:3000 tcp:3000\n" : "" };
      mapped = true; return { stdout: "3000" };
    });
    let stop = () => {};
    try {
      stop = await startAndroidUsb({ adb: "/fake/adb", run, log: vi.fn() });
      await vi.advanceTimersByTimeAsync(1);
      expect(run.mock.calls.filter(([, args]) => args.at(-1) === "tcp:3000")).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(run.mock.calls.filter(([, args]) => args.at(-1) === "tcp:3000")).toHaveLength(1);
      mapped = false;
      await vi.advanceTimersByTimeAsync(3000);
      expect(run.mock.calls.filter(([, args]) => args.at(-1) === "tcp:3000")).toHaveLength(2);
      stop(); const count = run.mock.calls.length;
      await vi.advanceTimersByTimeAsync(6000);
      expect(run).toHaveBeenCalledTimes(count);
    } finally { stop(); vi.useRealTimers(); }
  });
});
