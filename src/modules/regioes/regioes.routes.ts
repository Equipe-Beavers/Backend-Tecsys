import type { FastifyInstance } from "fastify";
import { RegioesRepository, type BoundingBox } from "./regioes.repository.js";

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

function numero(query: string | undefined): number | undefined {
    if (query === undefined || query.trim() === "") return undefined;
    const valor = Number(query);
    return Number.isFinite(valor) ? valor : undefined;
}

function paginaEValida(query: string | undefined): number {
    const valor = numero(query);
    return valor === undefined ? 1 : Math.max(Math.floor(valor), 1);
}

function boundingBox(query: {
    minLat?: string;
    maxLat?: string;
    minLng?: string;
    maxLng?: string;
}): BoundingBox | undefined {
    const valores = [numero(query.minLat), numero(query.maxLat), numero(query.minLng), numero(query.maxLng)];
    if (valores.every((valor) => valor === undefined)) return undefined;
    if (valores.some((valor) => valor === undefined)) return undefined;

    const [minLat, maxLat, minLng, maxLng] = valores as [number, number, number, number];
    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180 || minLat > maxLat || minLng > maxLng) {
        return undefined;
    }
    return { minLat, maxLat, minLng, maxLng };
}

export async function regioesRoutes(app: FastifyInstance): Promise<void> {
    const repo = new RegioesRepository();

    // GET /api/distribuidoras
    app.get<{ Querystring: { busca?: string } }>("/distribuidoras", async (req) => {
        return repo.listarDistribuidoras(req.query.busca);
    });

        // GET /api/estados
        app.get<{ Querystring: { busca?: string } }>("/estados", async (req) => {
            return repo.listarEstados(req.query.busca);
        });

    // GET /api/municipios
    app.get<{
        Querystring: {
            distribuidoraId?: string; busca?: string; limite?: string; pagina?: string;
            minLat?: string; maxLat?: string; minLng?: string; maxLng?: string;
        };
    }>("/municipios", async (req, reply) => {
        const { distribuidoraId, busca } = req.query;
        const limite = Math.min(
            Math.max(Number(req.query.limite) || LIMITE_PADRAO, 1),
            LIMITE_MAXIMO,
        );
        const pagina = paginaEValida(req.query.pagina);
        const bbox = boundingBox(req.query);
        const bboxInformado = [req.query.minLat, req.query.maxLat, req.query.minLng, req.query.maxLng].some(Boolean);
        const respostaPaginada = req.query.pagina !== undefined || bboxInformado;
        if (bboxInformado && !bbox) {
            return reply.status(400).send({ erro: "Bounding box inválido. Informe minLat, maxLat, minLng e maxLng válidos." });
        }


        if (!distribuidoraId) {
            if (!busca?.trim()) {
                return reply
                    .status(400)
                    .send({ erro: "Informe distribuidoraId ou um termo de busca." });
            }
            const resultado = await repo.buscarMunicipiosGlobal({ busca, limite, pagina, bbox });
            return respostaPaginada ? resultado : resultado.dados;
        }

        const id = Number(distribuidoraId);
        if (!Number.isInteger(id)) {
            return reply.status(400).send({ erro: "distribuidoraId inválido." });
        }

        const resultado = await repo.listarMunicipios({ distribuidoraId: id, busca, limite, pagina, bbox });
        return respostaPaginada ? resultado : resultado.dados;
    });

    // GET /api/bairros
    app.get<{
        Querystring: {
            distribuidoraId?: string;
            municipio?: string;
            busca?: string;
            limite?: string;
            pagina?: string;
        };
    }>('/bairros', async (req, reply) => {
        const { distribuidoraId, municipio, busca } = req.query;
        const limite = Math.min(
            Math.max(Number(req.query.limite) || LIMITE_PADRAO, 1),
            LIMITE_MAXIMO,
        );
        const pagina = paginaEValida(req.query.pagina);
        const respostaPaginada = req.query.pagina !== undefined;

        let id: number | undefined;
        if (distribuidoraId !== undefined) {
            id = Number(distribuidoraId);
            if (!Number.isInteger(id)) {
                return reply.status(400).send({ erro: 'distribuidoraId inválido.' });
            }
        }

        const resultado = await repo.listarBairros({ distribuidoraId: id, municipio, busca, limite, pagina });
        return respostaPaginada ? resultado : resultado.dados;
    });
}