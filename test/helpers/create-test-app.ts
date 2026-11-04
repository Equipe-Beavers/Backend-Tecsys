import { App } from "../../src/app.js";
import { vi } from "vitest";
import { SessionService } from "../../src/services/SessionService.js";
import { OwnershipService } from "../../src/services/OwnershipService.js";
import { randomUUID } from "node:crypto";

export function createTestApp() {
    // Business/schema unit tests simulate an authenticated user. Security and
    // PostgreSQL integration suites construct App directly and exercise real guards.
    vi.spyOn(SessionService.prototype, "isActive").mockResolvedValue(true);
    vi.spyOn(OwnershipService.prototype, "require").mockResolvedValue({ id_estudo: 1 });
    const app = new App({ authSecret: "unit-test-secret-of-at-least-thirty-two-bytes" }).getInstance();
    app.addHook("onRequest", async (request) => {
        request.headers.authorization = `Bearer ${await app.jwt.sign({ sub: "1", jti: randomUUID() })}`;
    });
    return app;
}
