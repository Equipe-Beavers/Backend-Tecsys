import { describe, expect, it } from "vitest";

import { BuildingsCalculation } from "../src/utils/BuildingsCalculation.js";
import { GeometryUtils } from "../src/utils/GeometryUtils.js";
import { ProvidedBuildings } from "../src/utils/ProvidedBuildings.js";

const LAT = -23.2;
const LON = -45.9;
const projector = new GeometryUtils().Projector(LAT, LON);
const AREA = { minLatitude: LAT - 0.01, maxLatitude: LAT + 0.01, minLongitude: LON - 0.01, maxLongitude: LON + 0.01 };

function square(x: number, y: number, side: number) {
    const ring = [[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]]
        .map(([px, py]) => projector.toGeo({ x: px!, y: py! }))
        .map((p) => [p.longitude, p.latitude]);
    return { type: "Polygon", coordinates: [ring] };
}

const item = (id: string, side: number, altura_m: number, codigo_material: string, x = 0) =>
    ({ id, altura_m, codigo_material, geometria: square(x, 0, side) });

describe("BuildingsCalculation.Calculate", () => {
    const provided = ProvidedBuildings.From({
        area: AREA,
        itens: [
            item("a", 10, 6, "CONCRETO", 0),
            item("b", 20, 12, "CONCRETO", 100),
            item("c", 10, 30, "VIDRO", 200),
            { id: "ruim", altura_m: 0, geometria: square(300, 0, 10) },
        ],
    });
    const result = new BuildingsCalculation().Calculate(provided, 915);

    it("conta as edificações válidas e as ignoradas", () => {
        expect(result.total_edificacoes).toBe(3);
        expect(result.edificacoes_ignoradas).toBe(1);
        expect(result.frequencia_mhz).toBe(915);
    });

    it("resume as alturas", () => {
        expect(result.altura_m).toEqual({ minima: 6, media: 16, maxima: 30 });
    });

    it("soma a área ocupada (100 + 400 + 100 m²)", () => {
        expect(result.area_ocupada_m2).toBeGreaterThanOrEqual(599);
        expect(result.area_ocupada_m2).toBeLessThanOrEqual(601);
    });

    it("agrupa por material com a perda da tabela do back na frequência do perfil", () => {
        expect(result.por_material.map((m) => [m.codigo_material, m.quantidade])).toEqual([["CONCRETO", 2], ["VIDRO", 1]]);
        expect(result.por_material[0]!.perda_db).toBeGreaterThan(11.5);
        expect(result.por_material[0]!.perda_db).toBeLessThan(12.5);
        expect(result.por_material[1]!.perda_db).toBeLessThan(2.5);
    });

    it("sem edificações devolve zeros e altura nula", () => {
        const empty = new BuildingsCalculation().Calculate(ProvidedBuildings.From({ area: AREA, itens: [] }), 915);

        expect(empty).toMatchObject({ total_edificacoes: 0, area_ocupada_m2: 0, altura_m: null, por_material: [] });
    });
});
