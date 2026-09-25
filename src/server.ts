import "dotenv/config";

import { App } from "./app.js";
import { closePool } from "./database/pool.js";
import { env } from "./config/env.js";


async function bootstrap() {
    try {
        const app = new App();
        const server = app.getInstance();

        const shutdown = async () => {
            await server.close();
            await closePool();
        };

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);

        await server.listen({
            port: env.port,
            host: "0.0.0.0",
        });
    } catch (error: any) {
        console.error("Erro ao iniciar o servidor: ", error);
        process.exit(1);
    }
}

void bootstrap();