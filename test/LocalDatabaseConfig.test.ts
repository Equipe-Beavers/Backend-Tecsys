import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("PostgreSQL environment isolation", () => {
  it.each([
    ["127.0.0.1", "false", 0],
    ["aws.example.invalid", "false", 1],
    ["aws.example.invalid", "true", 0],
  ])("validates host %s with explicit remote permission %s without opening a connection", (host, allowed, expectedStatus) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--eval", "import('./src/config/env.ts')"], {
      env: { ...process.env, DB_HOST: host, DB_NAME: "config_test", DB_USER: "test", DB_PASSWORD: "test", ALLOW_REMOTE_DATABASE: allowed },
      encoding: "utf8",
    });
    expect(result.status).toBe(expectedStatus);
    if (expectedStatus === 1) expect(result.stderr).toContain("remota bloqueada");
  });
});
