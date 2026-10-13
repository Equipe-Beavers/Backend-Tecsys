import { describe, expect, it } from "vitest";

import { BuildingUtils } from "../src/utils/BuildingUtils.js";

const utils = new BuildingUtils();

/** WKB (little endian) de um Polygon com um anel. */
function polygonWkb(ring: [number, number][]): string {
    const buffer = Buffer.alloc(1 + 4 + 4 + 4 + ring.length * 16);
    let offset = 0;
    buffer.writeUInt8(1, offset); offset += 1;
    buffer.writeUInt32LE(3, offset); offset += 4;
    buffer.writeUInt32LE(1, offset); offset += 4;
    buffer.writeUInt32LE(ring.length, offset); offset += 4;
    for (const [x, y] of ring) {
        buffer.writeDoubleLE(x, offset); offset += 8;
        buffer.writeDoubleLE(y, offset); offset += 8;
    }
    return buffer.toString("hex");
}

describe("BuildingUtils.EstimateHeight", () => {
    it("usa a altura informada pela fonte, sem inventar pavimentos", () => {
        expect(utils.EstimateHeight(15, null, 2)).toEqual({ heightM: 15, source: "INFORMADA", floors: null });
    });

    it("estima pela quantidade de pavimentos (3 m cada)", () => {
        expect(utils.EstimateHeight(null, 4, 2)).toEqual({ heightM: 12, source: "PAVIMENTOS", floors: 4 });
    });

    it("sem altura nem pavimentos, usa a regra padrão marcada como PADRAO", () => {
        expect(utils.EstimateHeight(Number.NaN, null, 2)).toEqual({ heightM: 6, source: "PADRAO", floors: null });
        expect(utils.EstimateHeight(null, 0, 3).heightM).toBe(9);
    });
});

describe("BuildingUtils.ClassifyMaterial", () => {
    it("usa o material da fachada informado pela fonte", () => {
        expect(utils.ClassifyMaterial("brick")).toEqual({ code: "ALVENARIA", source: "INFORMADO" });
        expect(utils.ClassifyMaterial("Glass")).toEqual({ code: "VIDRO", source: "INFORMADO" });
    });

    it("sem material (ou material desconhecido), usa cimento", () => {
        expect(utils.ClassifyMaterial(null)).toEqual({ code: "CIMENTO", source: "PADRAO" });
        expect(utils.ClassifyMaterial("unobtainium")).toEqual({ code: "CIMENTO", source: "PADRAO" });
    });

    it("interpola a perda do material em log(f)", () => {
        expect(utils.MaterialLossDb("CIMENTO", 900)).toBeCloseTo(12);
        expect(utils.MaterialLossDb("CIMENTO", 2400)).toBeCloseTo(17);
        expect(utils.MaterialLossDb("CIMENTO", 915)).toBeGreaterThan(12);
    });
});

describe("BuildingUtils.Normalize", () => {
    it("calcula largura, profundidade, área e centro a partir da geometria", () => {
        // Retângulo de ~10 m × ~20 m perto de São José dos Campos.
        const dLon = 10 / (111320 * Math.cos((-23.2 * Math.PI) / 180));
        const dLat = 20 / 111320;
        const ring: [number, number][] = [[-45.9, -23.2], [-45.9 + dLon, -23.2], [-45.9 + dLon, -23.2 + dLat], [-45.9, -23.2 + dLat], [-45.9, -23.2]];

        const building = utils.Normalize(
            { id: "abc", wkb_hex: polygonWkb(ring), subtype: null, class: null, height: null, num_floors: 3, facade_material: null, fonte_original: "OpenStreetMap" },
            "2026-09-23.1",
            2,
        )!;

        expect(building.largura_m).toBeCloseTo(10, 0);
        expect(building.profundidade_m).toBeCloseTo(20, 0);
        expect(building.area_m2).toBeCloseTo(200, -1);
        expect(building.altura_m).toBe(9);
        expect(building.codigo_material).toBe("CIMENTO");
        expect(building.origem_material).toBe("PADRAO");
        expect(building.latitude).toBeCloseTo(-23.2 + dLat / 2, 6);
    });

    it("descarta geometria inválida", () => {
        expect(utils.Normalize(
            { id: "x", wkb_hex: "00", subtype: null, class: null, height: null, num_floors: null, facade_material: null, fonte_original: null },
            "r",
            2,
        )).toBeNull();
    });
});

describe("BuildingUtils.TileKeys", () => {
    it("usa uma grade fixa que cobre a área toda", () => {
        const keys = utils.TileKeys({ minLatitude: -23.21, maxLatitude: -23.19, minLongitude: -45.91, maxLongitude: -45.89 }, 0.02);
        expect(keys).toHaveLength(4);
        const bounds = utils.TileBounds(keys[0]!, 0.02);
        expect(bounds.minLongitude).toBeLessThanOrEqual(-45.91);
    });
});
