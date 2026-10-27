import type {
    EmissoesRfBoundingBox,
    EmissoesRfListResponse,
    EmissoesRfQuery,
} from "../interface/emissoes-rf.js";
import { EmissoesRfRepository } from "../modules/repository/EmissoesRfRepository.js";

export class EmissoesRfValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EmissoesRfValidationError";
    }
}

export class EmissoesRfService {
    private readonly repository: EmissoesRfRepository;

    constructor(repository?: EmissoesRfRepository) {
        this.repository = repository ?? new EmissoesRfRepository();
    }

    async listar(query: EmissoesRfQuery): Promise<EmissoesRfListResponse> {
        const bbox: EmissoesRfBoundingBox = {
            minLatitude: this.parseCoordinate(query.minLatitude, "minLatitude"),
            maxLatitude: this.parseCoordinate(query.maxLatitude, "maxLatitude"),
            minLongitude: this.parseCoordinate(query.minLongitude, "minLongitude"),
            maxLongitude: this.parseCoordinate(query.maxLongitude, "maxLongitude"),
        };
        if (
            bbox.minLatitude < -90 || bbox.maxLatitude > 90 ||
            bbox.minLongitude < -180 || bbox.maxLongitude > 180 ||
            bbox.minLatitude > bbox.maxLatitude || bbox.minLongitude > bbox.maxLongitude
        ) {
            throw new EmissoesRfValidationError("Bounding box inválido.");
        }
        const limit = this.parseLimit(query.limit);
        return this.repository.listarPorArea(bbox, limit);
    }

    private parseCoordinate(value: string | undefined, name: string): number {
        if (value === undefined || value.trim() === "") {
            throw new EmissoesRfValidationError(`Parâmetro '${name}' é obrigatório.`);
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            throw new EmissoesRfValidationError(`Parâmetro '${name}' deve ser numérico.`);
        }
        return parsed;
    }

    private parseLimit(value: string | undefined): number {
        if (value === undefined) return 5000;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) {
            throw new EmissoesRfValidationError("Parâmetro 'limit' deve ser um inteiro entre 1 e 10000.");
        }
        return parsed;
    }
}
