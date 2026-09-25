import fastify, { type FastifyInstance } from "fastify";

import cors from "@fastify/cors";

import {
    estudoRoutes
} from "./routes/estudo.routes.js";

import {
    estudoPontoRoutes
} from "./routes/estudo-ponto.routes.js";

import {
    usuarioRoutes
} from "./routes/usuario.routes.js";

import {
    perfilRfRoutes
} from "./routes/perfil-rf.routes.js";

import {
    criterioInstalacaoRoutes
} from "./routes/criterio-instalacao.routes.js";

import {
    cenarioRoutes
} from "./routes/cenario.routes.js";

import {
    cenarioGatewayRoutes
} from "./routes/cenario-gateway.routes.js";

import {
    cenarioAtendimentoRoutes
} from "./routes/cenario-atendimento.routes.js";

import { recomendacaoRoutes } from "./routes/recomendacao.routes.js";

import { ativoRoutes } from "./modules/ativos/ativo.routes.js";

class App {

    public app: FastifyInstance;

    constructor() {
        this.app = fastify({
            logger: true,
            ajv: {
                customOptions: {
                    removeAdditional: false
                }
            }
        });

        void this.app.register(cors, { origin: true });

        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.app.register(estudoRoutes);

        this.app.register(estudoPontoRoutes);

        this.app.register(usuarioRoutes);

        this.app.register(perfilRfRoutes);

        this.app.register(criterioInstalacaoRoutes);

        this.app.register(cenarioRoutes);

        this.app.register(cenarioGatewayRoutes);

        this.app.register(cenarioAtendimentoRoutes);

        this.app.register(recomendacaoRoutes);

        this.app.register(ativoRoutes);
    }

    async listen(port: number) {
        try {
            await this.app.listen({
                port,
                host: "0.0.0.0"
            });

            console.log(
                `O servidor está rodando na porta ${port}`
            );

        } catch (error) {
            this.app.log.error(error);

            process.exit(1);
        }
    }

    public getInstance(): FastifyInstance {
        return this.app;
    }
}

export { App };