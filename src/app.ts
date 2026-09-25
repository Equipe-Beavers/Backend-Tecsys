import fastify from "fastify"
import cors from "@fastify/cors";
import { ativoRoutes } from "./modules/ativos/ativo.routes.js";

class App {
    public app: fastify.FastifyInstance;
    constructor() {
        this.app = fastify({ logger: true })
        void this.app.register(cors, { origin: true });
        this.routes();
    }

    async listen(port: number) {
        try {
            await this.app.listen({ port: port, host: '0.0.0.0'});
            console.log(`O servidor está rodando na porta ${port}`);
        } catch (error: any) {
            this.app.log.error(error);
            process.exit(1);
        }
    }

    public getInstance() {
        return this.app;
    }

    routes() {
        this.app.get("/health", async () => ({ status: "ok" }));
        void this.app.register(ativoRoutes);
    }
}

export { App }