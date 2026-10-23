import type {
    AntenasBoundingBox,
    AntenasListResponse,
    AntenasQuery,
} from "../interface/antena.js";
import { AntenasRepository } from "../modules/repository/AntenasRepository.js";

export class AntenasValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AntenasValidationError";
    }
}

export class AntenasService {
    private readonly antenasRepository: AntenasRepository;

    constructor(antenasRepository?: AntenasRepository) {
        this.antenasRepository = antenasRepository ?? new AntenasRepository();
    }

    async listar(query: AntenasQuery): Promise<AntenasListResponse> {
        const bbox: AntenasBoundingBox = {
            minLatitude: this.parseCoordinate(query.minLatitude, "minLatitude"),
            maxLatitude: this.parseCoordinate(query.maxLatitude, "maxLatitude"),
            minLongitude: this.parseCoordinate(query.minLongitude, "minLongitude"),
            maxLongitude: this.parseCoordinate(query.maxLongitude, "maxLongitude"),
        };

        if (
            bbox.minLatitude < -90 || bbox.maxLatitude > 90 ||
            bbox.minLongitude < -180 || bbox.maxLongitude > 180 ||
            bbox.minLatitude > bbox.maxLatitude ||
            bbox.minLongitude > bbox.maxLongitude
        ) {
            throw new AntenasValidationError("Bounding box inválido.");
        }

        const limit = this.parseLimit(query.limit);
        return this.antenasRepository.listarPorArea(bbox, limit);
    }

    private parseCoordinate(value: string | undefined, name: string): number {
        if (value === undefined || value.trim() === "") {
            throw new AntenasValidationError(`Parâmetro '${name}' é obrigatório.`);
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            throw new AntenasValidationError(`Parâmetro '${name}' deve ser numérico.`);
        }
        return parsed;
    }

    private parseLimit(value: string | undefined): number {
        if (value === undefined) return 1000;

        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3000) {
            throw new AntenasValidationError(
                "Parâmetro 'limit' deve ser um inteiro entre 1 e 3000.",
            );
        }
        return parsed;
    }
}
