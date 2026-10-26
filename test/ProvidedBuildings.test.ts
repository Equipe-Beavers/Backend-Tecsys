import { describe, expect, it } from "vitest";

import { GeometryUtils } from "../src/utils/GeometryUtils.js";
import { ProvidedBuildings } from "../src/utils/ProvidedBuildings.js";

const geometry = new GeometryUtils();
const LAT = -23.2;
const LON = -45.9;
const projector = geometry.Projector(LAT, LON);

const AREA = { minLatitude: LAT - 0.01, maxLatitude: LAT + 0.01, minLongitude: LON - 0.01, maxLongitude: LON + 0.01 };

function squareGeometry(x: number, y: number, side: number) {
    const ring = [[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]]
        .map(([px, py]) => projector.toGeo({ x: px!, y: py! }))
        .map((p) => [p.longitude, p.latitude]);
    return { type: "Polygon", coordinates: [ring] };
}

function item(id: string, x: number, y: number, extra: Record<string, unknown> = {}) {
    return { id, altura_m: 12, codigo_material: "CONCRETO", geometria: squareGeometry(x, y, 20), ...extra };
}

describe("ProvidedBuildings.From", () => {
    it("converte as edificações enviadas pelo front", () => {
        const provided = ProvidedBuildings.From({ area: AREA, itens: [item("a", 100, 0), item("b", 200, 0)] });

        expect(provided.buildings).toHaveLength(2);
        expect(provided.ignored).toBe(0);
        expect(provided.buildings[0]).toMatchObject({ id: "a", altura_m: 12, codigo_material: "CONCRETO" });
    });

    it("aceita MultiPolygon", () => {
        const polygon = squareGeometry(100, 0, 20);
        const provided = ProvidedBuildings.From({
            area: AREA,
            itens: [{ id: "m", altura_m: 8, geometria: { type: "MultiPolygon", coordinates: [polygon.coordinates] } }],
        });

        expect(provided.buildings).toHaveLength(1);
    });

    it("usa o material padrão quando o código é desconhecido e mantém os válidos", () => {
        const provided = ProvidedBuildings.From({
            area: AREA,
            itens: [item("a", 100, 0, { codigo_material: "OURO" }), item("b", 200, 0, { codigo_material: "VIDRO" })],
        });

        expect(provided.buildings.map((b) => b.codigo_material)).toEqual(["CONCRETO", "VIDRO"]);
    });

    it("ignora edificações inválidas sem derrubar as demais", () => {
        const provided = ProvidedBuildings.From({
            area: AREA,
            itens: [
                item("ok", 100, 0),
                item("sem-altura", 120, 0, { altura_m: 0 }),
                item("altura-absurda", 140, 0, { altura_m: 5000 }),
                item("sem-geometria", 160, 0, { geometria: null }),
                { id: "anel-curto", altura_m: 5, geometria: { type: "Polygon", coordinates: [[[LON, LAT], [LON, LAT]]] } },
                "lixo",
            ],
        });

        expect(provided.buildings.map((b) => b.id)).toEqual(["ok"]);
        expect(provided.ignored).toBe(5);
    });

    it("rejeita payload malformado", () => {
        expect(() => ProvidedBuildings.From(null)).toThrow();
        expect(() => ProvidedBuildings.From({ itens: [] })).toThrow(/area/);
        expect(() => ProvidedBuildings.From({ area: { ...AREA, minLatitude: 10 }, itens: [] })).toThrow(/area/);
        expect(() => ProvidedBuildings.From({ area: AREA, itens: "x" })).toThrow(/itens/);
    });
});

describe("ProvidedBuildings.Around", () => {
    const provided = ProvidedBuildings.From({ area: AREA, itens: [item("perto", 100, -10), item("longe", 4000, 0)] });

    it("monta o índice só com as edificações dentro do alcance do gateway", () => {
        const around = provided.Around(LAT, LON, 500)!;

        expect(around.error).toBeNull();
        expect(around.radiusM).toBe(500);
        expect(around.index?.size).toBe(1);
    });

    it("o índice enxerga a edificação que cruza o enlace", () => {
        const around = provided.Around(LAT, LON, 500)!;
        const end = projector.toGeo({ x: 300, y: 0 });
        const rows = around.index!.Crossings([{
            id: "enlace",
            origin: { latitude: LAT, longitude: LON, height_m: 5 },
            destination: { latitude: end.latitude, longitude: end.longitude, height_m: 2 },
        }], 915);

        expect(rows.map((row) => row.id_edificacao)).toEqual(["perto"]);
        expect(rows[0]!.altura_m).toBe(12);
    });

    it("limita o raio à distância até a borda da área enviada", () => {
        const edgeM = provided.DistanceToEdgeM(LAT, LON);
        const around = provided.Around(LAT, LON, 100000)!;

        expect(around.radiusM).toBeCloseTo(edgeM, 5);
        expect(around.radiusM).toBeLessThan(100000);
    });

    it("devolve null para gateway fora da área, para o chamador usar a fonte externa", () => {
        expect(provided.Around(LAT + 1, LON, 500)).toBeNull();
    });
});

describe("ProvidedBuildings com poligono", () => {
    const triangle = [
        [AREA.minLongitude, AREA.minLatitude],
        [AREA.maxLongitude, AREA.minLatitude],
        [AREA.minLongitude, AREA.maxLatitude],
    ];
    const provided = ProvidedBuildings.From({ area: AREA, poligono: triangle, itens: [item("a", 100, 0)] });

    it("gateway dentro do desenho usa a distância até a borda do contorno", () => {
        const edgeM = provided.DistanceToEdgeM(AREA.minLatitude + 0.002, AREA.minLongitude + 0.002);

        expect(edgeM).toBeGreaterThan(0);
        const box = ProvidedBuildings.From({ area: AREA, itens: [] });
        expect(edgeM).toBeLessThanOrEqual(box.DistanceToEdgeM(AREA.minLatitude + 0.002, AREA.minLongitude + 0.002));
    });

    it("gateway dentro do retângulo mas fora do desenho devolve null", () => {
        const lat = AREA.maxLatitude - 0.001;
        const lon = AREA.maxLongitude - 0.001;

        expect(provided.DistanceToEdgeM(lat, lon)).toBeLessThan(0);
        expect(provided.Around(lat, lon, 500)).toBeNull();
    });

    it("aceita contorno já fechado e recusa contorno inválido", () => {
        expect(() => ProvidedBuildings.From({ area: AREA, poligono: [...triangle, triangle[0]], itens: [] })).not.toThrow();
        expect(() => ProvidedBuildings.From({ area: AREA, poligono: [[0, 0], [1, 1]], itens: [] })).toThrow(/poligono/);
        expect(() => ProvidedBuildings.From({ area: AREA, poligono: [[0, 0], [1, 1], ["x", 2]], itens: [] })).toThrow(/poligono/);
    });
});
