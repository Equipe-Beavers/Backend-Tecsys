import { describe, expect, it } from "vitest";

import { BuildingUtils } from "../src/utils/BuildingUtils.js";

const utils = new BuildingUtils();

describe("BuildingUtils.EstimateHeight", () => {
    it("usa a altura informada pela fonte", () => {
        expect(utils.EstimateHeight(15, null, "residential", "apartments")).toEqual({ heightM: 15, source: "INFORMADA", floors: 5 });
    });

    it("estima pela quantidade de pavimentos", () => {
        expect(utils.EstimateHeight(null, 4, null, null)).toEqual({ heightM: 12, source: "PAVIMENTOS", floors: 4 });
    });

    it("usa a altura padrão de casa ou de galpão", () => {
        expect(utils.EstimateHeight(Number.NaN, null, "residential", "house").heightM).toBe(6);
        expect(utils.EstimateHeight(null, null, "industrial", null).heightM).toBe(8);
    });
});

describe("BuildingUtils.ClassifyMaterial", () => {
    it("usa o material da fachada informado", () => {
        expect(utils.ClassifyMaterial("brick", null, null, null, "CONCRETO")).toEqual({ code: "ALVENARIA", source: "INFORMADO" });
    });

    it("aplica as regras de galpão, prédio alto e construção leve", () => {
        expect(utils.ClassifyMaterial(null, null, "warehouse", null, "CONCRETO").code).toBe("METAL");
        expect(utils.ClassifyMaterial(null, "residential", "apartments", 8, "ALVENARIA").code).toBe("CONCRETO");
        expect(utils.ClassifyMaterial(null, null, "hut", 1, "CONCRETO").code).toBe("MADEIRA");
    });

    it("sem informação, usa o material padrão (concreto armado)", () => {
        expect(utils.ClassifyMaterial(null, "residential", "house", 1, "CONCRETO")).toEqual({ code: "CONCRETO", source: "PADRAO" });
    });
});

describe("BuildingUtils.Tiles", () => {
    it("divide a área em quadrados que cobrem tudo", () => {
        const tiles = utils.Tiles({ minLatitude: -24, maxLatitude: -23.95, minLongitude: -46, maxLongitude: -45.9 });
        expect(tiles).toHaveLength(2);
        expect(tiles[0]!.minLongitude).toBe(-46);
        expect(tiles[1]!.maxLongitude).toBeCloseTo(-45.9);
    });
});
