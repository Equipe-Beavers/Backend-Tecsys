import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegionsService } from "../src/services/RegionsService.js";

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/database/pool.js", () => ({ pool: db }));
const rows = ["A", "B", "C"].map((nome) => ({ nome, uf: "SP", total_ativos: "2", lat: -23, lng: -45 }));
const params = { distribuidora: "EDP", uf: "SP", limite: 2, pagina: 1 };
beforeEach(() => { db.query.mockReset().mockResolvedValue({ rows }); });
afterEach(() => { vi.restoreAllMocks(); });

describe("listagem de municípios sem varreduras repetidas", () => {
  it("agrega uma vez e reutiliza os totais e demais páginas do filtro", async () => {
    const service = new RegionsService();
    const first = await service.listMunicipio(params);
    expect(first.paginacao).toEqual({ pagina: 1, limite: 2, total: 3, totalPaginas: 2 });
    expect(first.dados.map((item) => item.nome)).toEqual(["A", "B"]);
    first.dados[0]!.nome = "modificado";
    expect((await service.listMunicipio({ ...params, pagina: 2 })).dados.map((item) => item.nome)).toEqual(["C"]);
    expect((await service.listMunicipio(params)).dados[0]!.nome).toBe("A");
    expect((await service.listMunicipio({ ...params, pagina: 5 })).dados).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0]![0]).toContain("EXISTS");
    expect(db.query.mock.calls[0]![1]).toEqual(["EDP", "SP"]);
  });

  it("compartilha consultas simultâneas e não mistura filtros", async () => {
    const service = new RegionsService();
    await Promise.all([service.listMunicipio(params), service.listMunicipio(params)]);
    expect(db.query).toHaveBeenCalledTimes(1);
    await service.listMunicipio({ ...params, distribuidora: "Outra" });
    await service.listMunicipio({ ...params, busca: "A" });
    await service.listMunicipio({ ...params, bbox: { minLat: -24, maxLat: -22, minLng: -46, maxLng: -44 } });
    expect(db.query).toHaveBeenCalledTimes(4);
  });

  it("expira o cache e permite tentar novamente após erro", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const service = new RegionsService();
    await service.listMunicipio(params);
    now.mockReturnValue(61_001);
    db.query.mockRejectedValueOnce(new Error("temporário"));
    await expect(service.listMunicipio(params)).rejects.toThrow("temporário");
    await service.listMunicipio(params);
    expect(db.query).toHaveBeenCalledTimes(3);
  });

  it("preserva paginação de um resultado vazio", async () => {
    db.query.mockResolvedValue({ rows: [] });
    expect(await new RegionsService().listMunicipio(params)).toEqual({ dados: [], paginacao: { pagina: 1, limite: 2, total: 0, totalPaginas: 0 } });
  });
});
