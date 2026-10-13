import { describe, expect, it } from "vitest";

import type { CachedBuilding } from "../src/interface/BuildingDTO.js";
import { BuildingIndex } from "../src/utils/BuildingIndex.js";
import { GeometryUtils } from "../src/utils/GeometryUtils.js";

const geometry = new GeometryUtils();
const LAT = -23.2;
const LON = -45.9;
const projector = geometry.Projector(LAT, LON);

/** Quadrado de `side` metros com o canto sudoeste em (x, y) metros do ponto de referência. */
function square(id: string, x: number, y: number, side: number, heightM = 12): CachedBuilding {
    const corners = [[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]]
        .map(([px, py]) => projector.toGeo({ x: px!, y: py! }))
        .map((p) => [p.longitude, p.latitude] as [number, number]);
    const lats = corners.map((c) => c[1]);
    const lons = corners.map((c) => c[0]);
    return {
        id, fonte: "OVERTURE", fonte_original: null, versao_fonte: "test", subtipo: null, classe: null,
        altura_m: heightM, origem_altura: "INFORMADA", pavimentos: null,
        largura_m: side, profundidade_m: side, area_m2: side * side,
        codigo_material: "CIMENTO", nome_material: "Cimento / concreto", origem_material: "PADRAO",
        material_fachada_original: null, latitude: LAT, longitude: LON,
        polygons: [[corners]],
        bbox: { minLatitude: Math.min(...lats), maxLatitude: Math.max(...lats), minLongitude: Math.min(...lons), maxLongitude: Math.max(...lons) },
    };
}

function link(id: string, toX: number, toY: number) {
    const end = projector.toGeo({ x: toX, y: toY });
    return {
        id,
        origin: { latitude: LAT, longitude: LON, height_m: 15 },
        destination: { latitude: end.latitude, longitude: end.longitude, height_m: 2 },
    };
}

describe("GeometryUtils.SegmentInsideIntervals", () => {
    it("acha o trecho do segmento dentro do polígono", () => {
        const ring = [{ x: 10, y: -5 }, { x: 30, y: -5 }, { x: 30, y: 5 }, { x: 10, y: 5 }, { x: 10, y: -5 }];
        const intervals = geometry.SegmentInsideIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, [ring]);
        expect(intervals).toHaveLength(1);
        expect(intervals[0]![0]).toBeCloseTo(0.1);
        expect(intervals[0]![1]).toBeCloseTo(0.3);
    });

    it("respeita os buracos (pátios internos)", () => {
        const outer = [{ x: 10, y: -10 }, { x: 50, y: -10 }, { x: 50, y: 10 }, { x: 10, y: 10 }, { x: 10, y: -10 }];
        const hole = [{ x: 20, y: -5 }, { x: 40, y: -5 }, { x: 40, y: 5 }, { x: 20, y: 5 }, { x: 20, y: -5 }];
        const intervals = geometry.SegmentInsideIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, [outer, hole]);
        expect(intervals).toHaveLength(2);
    });
});

describe("BuildingIndex.Crossings", () => {
    const index = new BuildingIndex(
        [square("a", 100, -10, 20), square("b", 300, -10, 20, 30), square("fora", 100, 200, 20)],
        LAT,
        LON,
    );

    it("encontra as edificações cruzadas pelo enlace, em ordem de distância", () => {
        const rows = index.Crossings([link("l1", 500, 0)], 915);
        expect(rows.map((r) => r.id_edificacao)).toEqual(["a", "b"]);
        expect(rows[0]!.distancia_origem_m).toBeCloseTo(100, 0);
        expect(rows[0]!.trecho_m).toBeCloseTo(20, 0);
        expect(rows[0]!.altura_linha_m).toBeCloseTo(15 - 13 * (100 / 500), 1);
        expect(rows[0]!.perda_material_db).toBeGreaterThan(12);
    });

    it("não devolve edificações fora da linha", () => {
        expect(index.Crossings([link("l2", 0, -500)], 915)).toHaveLength(0);
    });

    it("trata o ponto de destino dentro da edificação", () => {
        const rows = index.Crossings([link("l3", 110, 0)], 915);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.trecho_m).toBeCloseTo(10, 0);
    });
});
