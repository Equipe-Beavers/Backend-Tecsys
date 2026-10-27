import { describe, expect, it, vi } from "vitest";
import type { EmissoesRfListResponse } from "../src/interface/emissoes-rf.js";
import { EmissoesRfService, EmissoesRfValidationError } from "../src/services/EmissoesRfService.js";
import type { EmissoesRfRepository } from "../src/modules/repository/EmissoesRfRepository.js";

const respostaVazia: EmissoesRfListResponse = { data: [], total: 0, limit: 5000 };

function criarService() {
    const repositorio = {
        listarPorArea: vi.fn().mockResolvedValue(respostaVazia),
    } as unknown as EmissoesRfRepository;
    return { service: new EmissoesRfService(repositorio), repositorio };
}

describe("EmissoesRfService", () => {
    it("valida e encaminha a bounding box", async () => {
        const { service, repositorio } = criarService();
        await expect(service.listar({
            minLatitude: "-23.8", maxLatitude: "-23.0",
            minLongitude: "-46.3", maxLongitude: "-45.7", limit: "250",
        })).resolves.toEqual(respostaVazia);
        expect(repositorio.listarPorArea).toHaveBeenCalledWith({
            minLatitude: -23.8, maxLatitude: -23.0,
            minLongitude: -46.3, maxLongitude: -45.7,
        }, 250);
    });

    it("usa limite padrão de 5000", async () => {
        const { service, repositorio } = criarService();
        await service.listar({
            minLatitude: "-23.8", maxLatitude: "-23.0",
            minLongitude: "-46.3", maxLongitude: "-45.7",
        });
        expect(repositorio.listarPorArea).toHaveBeenCalledWith(expect.any(Object), 5000);
    });

    it.each([
        {},
        { minLatitude: "xyz", maxLatitude: "-23", minLongitude: "-46", maxLongitude: "-45" },
        { minLatitude: "-22", maxLatitude: "-23", minLongitude: "-46", maxLongitude: "-45" },
        { minLatitude: "-23", maxLatitude: "-22", minLongitude: "-45", maxLongitude: "-46" },
        { minLatitude: "-23", maxLatitude: "-22", minLongitude: "-46", maxLongitude: "-45", limit: "10001" },
    ])("rejeita parâmetros inválidos (%o)", async (query) => {
        const { service, repositorio } = criarService();
        await expect(service.listar(query)).rejects.toBeInstanceOf(EmissoesRfValidationError);
        expect(repositorio.listarPorArea).not.toHaveBeenCalled();
    });
});
