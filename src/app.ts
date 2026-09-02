import fastify from "fastify"

class App {
    public app: fastify.FastifyInstance;
    constructor() {
        this.app = fastify({ logger: true })
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
        // Escrever as rotas do API aqui
    }
}

export { App }