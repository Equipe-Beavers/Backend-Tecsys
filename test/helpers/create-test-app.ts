import { App } from "../../src/app.js";

export function createTestApp() {
    return new App().getInstance();
}