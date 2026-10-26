import { describe, expect, it, vi } from "vitest";
import type { AntenasListResponse } from "../src/interface/antena.js";
import { AntenasService, AntenasValidationError } from "../src/services/AntenasService.js";
import type { AntenasRepository } from "../src/modules/repository/AntenasRepository.js";

const respostaVazia: AntenasListResponse = { data: [], total: 0 };

function criarService() {
    const repositorio = {
        listarPorArea: vi.fn().mockResolvedValue(respostaVazia),
    } as unknown as AntenasRepository;

    return {
        service: new AntenasService(repositorio),
        repositorio,
    };
}

describe("AntenasService", () => {
    it("valida e encaminha a bounding box para o repository", async () => {
        const { service, repositorio } = criarService();

        await expect(service.listar({
            minLatitude: "-23.8",
            maxLatitude: "-23.0",
            minLongitude: "-46.3",
            maxLongitude: "-45.7",
            limit: "200",
        })).resolves.toEqual(respostaVazia);

        expect(repositorio.listarPorArea).toHaveBeenCalledWith({
            minLatitude: -23.8,
            maxLatitude: -23.0,
            minLongitude: -46.3,
            maxLongitude: -45.7,
        }, 200);
    });

    it("usa o limite padrão quando não informado", async () => {
        const { service, repositorio } = criarService();
        await service.listar({
            minLatitude: "-23.8",
            maxLatitude: "-23.0",
            minLongitude: "-46.3",
            maxLongitude: "-45.7",
        });
        expect(repositorio.listarPorArea).toHaveBeenCalledWith(expect.any(Object), 1000);
    });

    it.each([
        {},
        { minLatitude: "abc", maxLatitude: "-23", minLongitude: "-46", maxLongitude: "-45" },
        { minLatitude: "-22", maxLatitude: "-23", minLongitude: "-46", maxLongitude: "-45" },
        { minLatitude: "-23", maxLatitude: "-22", minLongitude: "-45", maxLongitude: "-46" },
        { minLatitude: "-23", maxLatitude: "-22", minLongitude: "-46", maxLongitude: "-45", limit: "5001" },
    ])("rejeita parâmetros inválidos (%o)", async (query) => {
        const { service, repositorio } = criarService();
        await expect(service.listar(query)).rejects.toBeInstanceOf(AntenasValidationError);
        expect(repositorio.listarPorArea).not.toHaveBeenCalled();
    });
});
