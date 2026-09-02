import { App } from "./app.js";

async function bootstrap() {
    try {
        const port = Number(process.env.PORT) || 3000;
        const app = new App();
        const server = app.getInstance();
        await server.listen({
            port,
            host: "0.0.0.0",
        });
    } catch (error: any) {
        console.error("Erro ao iniciar o servidor: ", error);
        process.exit(1);
    }
}