import type { BuildingOnLinkRow, CachedBuilding, LinkDTO } from "../interface/BuildingDTO.js";
import { BuildingUtils } from "./BuildingUtils.js";
import { GeometryUtils, type LocalPoint } from "./GeometryUtils.js";

const CELL_SIZE_M = 50;

interface IndexedBuilding {
    building: CachedBuilding;
    rings: LocalPoint[][];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Índice em grade (células de 50 m) das edificações de uma região, num plano local em metros.
 * Encontra as edificações cruzadas pela linha reta de cada enlace — o que antes era feito
 * com ST_Intersects/ST_Intersection no banco.
 */
export class BuildingIndex {
    private geometryUtils = new GeometryUtils();
    private buildingUtils = new BuildingUtils();
    private projector;
    private cells = new Map<string, IndexedBuilding[]>();
    readonly size: number;

    constructor(buildings: CachedBuilding[], originLatitude: number, originLongitude: number) {
        this.projector = this.geometryUtils.Projector(originLatitude, originLongitude);
        this.size = buildings.length;

        for (const building of buildings) {
            const rings = building.polygons.flatMap((polygon) =>
                polygon.map((ring) => ring.map(([lon, lat]) => this.projector.toLocal(lon, lat))));
            const xs = rings.flatMap((ring) => ring.map((p) => p.x));
            const ys = rings.flatMap((ring) => ring.map((p) => p.y));
            const item: IndexedBuilding = {
                building,
                rings,
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
            };

            for (let cx = Math.floor(item.minX / CELL_SIZE_M); cx <= Math.floor(item.maxX / CELL_SIZE_M); cx++) {
                for (let cy = Math.floor(item.minY / CELL_SIZE_M); cy <= Math.floor(item.maxY / CELL_SIZE_M); cy++) {
                    const key = `${cx}:${cy}`;
                    const list = this.cells.get(key);
                    if (list) list.push(item);
                    else this.cells.set(key, [item]);
                }
            }
        }
    }

    /** Células atravessadas pelo segmento (percurso em grade de Amanatides & Woo). */
    private cellsOnSegment(start: LocalPoint, end: LocalPoint): string[] {
        let cx = Math.floor(start.x / CELL_SIZE_M);
        let cy = Math.floor(start.y / CELL_SIZE_M);
        const endX = Math.floor(end.x / CELL_SIZE_M);
        const endY = Math.floor(end.y / CELL_SIZE_M);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);
        const tDeltaX = stepX !== 0 ? CELL_SIZE_M / Math.abs(dx) : Infinity;
        const tDeltaY = stepY !== 0 ? CELL_SIZE_M / Math.abs(dy) : Infinity;
        let tMaxX = stepX > 0 ? ((cx + 1) * CELL_SIZE_M - start.x) / dx : stepX < 0 ? (cx * CELL_SIZE_M - start.x) / dx : Infinity;
        let tMaxY = stepY > 0 ? ((cy + 1) * CELL_SIZE_M - start.y) / dy : stepY < 0 ? (cy * CELL_SIZE_M - start.y) / dy : Infinity;

        const keys = [`${cx}:${cy}`];
        const limit = Math.abs(endX - cx) + Math.abs(endY - cy);
        for (let i = 0; i < limit; i++) {
            if (tMaxX < tMaxY) {
                cx += stepX;
                tMaxX += tDeltaX;
            } else {
                cy += stepY;
                tMaxY += tDeltaY;
            }
            keys.push(`${cx}:${cy}`);
        }
        return keys;
    }

    /**
     * Edificações cruzadas pela linha reta de cada enlace, ordenadas pela distância da origem.
     * `distancia_origem_m`: onde a linha entra na edificação; `trecho_m`: comprimento dentro dela;
     * `altura_linha_m`: altura da linha de visada nesse ponto (sem relevo).
     */
    Crossings(links: LinkDTO[], frequencyMhz: number): BuildingOnLinkRow[] {
        const rows: BuildingOnLinkRow[] = [];
        const lossByMaterial = new Map<string, number>();

        for (const link of links) {
            const start = this.projector.toLocal(link.origin.longitude, link.origin.latitude);
            const end = this.projector.toLocal(link.destination.longitude, link.destination.latitude);
            const lengthM = Math.hypot(end.x - start.x, end.y - start.y);
            if (lengthM === 0) continue;

            const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
            const seen = new Set<IndexedBuilding>();
            const linkRows: (BuildingOnLinkRow & { fraction: number })[] = [];

            for (const key of this.cellsOnSegment(start, end)) {
                for (const item of this.cells.get(key) ?? []) {
                    if (seen.has(item)) continue;
                    seen.add(item);
                    if (item.maxX < minX || item.minX > maxX || item.maxY < minY || item.minY > maxY) continue;

                    const intervals = this.geometryUtils.SegmentInsideIntervals(start, end, item.rings);
                    if (intervals.length === 0) continue;

                    const fraction = intervals[0]![0];
                    const insideM = intervals.reduce((sum, [t0, t1]) => sum + (t1 - t0) * lengthM, 0);
                    const code = item.building.codigo_material;
                    let loss = lossByMaterial.get(code);
                    if (loss === undefined) {
                        loss = this.buildingUtils.MaterialLossDb(code, frequencyMhz);
                        lossByMaterial.set(code, loss);
                    }

                    linkRows.push({
                        id: link.id,
                        id_edificacao: item.building.id,
                        altura_m: item.building.altura_m,
                        codigo_material: code,
                        distancia_origem_m: fraction * lengthM,
                        altura_linha_m: link.origin.height_m + (link.destination.height_m - link.origin.height_m) * fraction,
                        trecho_m: insideM,
                        comprimento_enlace_m: lengthM,
                        perda_material_db: loss,
                        fraction,
                    });
                }
            }

            linkRows.sort((a, b) => a.fraction - b.fraction);
            for (const { fraction: _fraction, ...row } of linkRows) rows.push(row);
        }
        return rows;
    }
}
