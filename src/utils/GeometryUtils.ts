const EARTH_RADIUS_M = 6371000;
const RAD = Math.PI / 180;

export type Ring = [number, number][];
export type PolygonRings = Ring[];

export interface GeoJsonMultiPolygon {
    type: "MultiPolygon";
    coordinates: number[][][][];
}

export interface LocalPoint {
    x: number;
    y: number;
}

export class GeometryUtils {
    /** Lê um WKB (hex) de Polygon ou MultiPolygon 2D. Outros tipos devolvem lista vazia. */
    ParseWkbPolygons(hex: string): PolygonRings[] {
        const buffer = Buffer.from(hex, "hex");
        let offset = 0;

        const readGeometry = (): PolygonRings[] => {
            const littleEndian = buffer.readUInt8(offset) === 1;
            offset += 1;
            const readUInt32 = () => {
                const value = littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
                offset += 4;
                return value;
            };
            const readDouble = () => {
                const value = littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
                offset += 8;
                return value;
            };

            const rawType = readUInt32();
            const hasZ = (rawType & 0x80000000) !== 0 || (rawType % 10000 >= 1000 && rawType % 10000 < 2000) || rawType % 10000 >= 3000;
            const hasM = (rawType & 0x40000000) !== 0 || rawType % 10000 >= 2000;
            if ((rawType & 0x20000000) !== 0) offset += 4; // SRID do EWKB
            const type = (rawType & 0x0fffffff) % 1000;
            const dimensions = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);

            const readPolygon = (): PolygonRings => {
                const rings: PolygonRings = [];
                const ringCount = readUInt32();
                for (let r = 0; r < ringCount; r++) {
                    const pointCount = readUInt32();
                    const ring: Ring = [];
                    for (let p = 0; p < pointCount; p++) {
                        const x = readDouble();
                        const y = readDouble();
                        offset += 8 * (dimensions - 2);
                        ring.push([x, y]);
                    }
                    rings.push(ring);
                }
                return rings;
            };

            if (type === 3) return [readPolygon()];
            if (type === 6) {
                const polygons: PolygonRings[] = [];
                const count = readUInt32();
                for (let i = 0; i < count; i++) polygons.push(...readGeometry());
                return polygons;
            }
            return [];
        };

        try {
            return readGeometry().filter((polygon) => polygon.length > 0 && polygon[0]!.length >= 4);
        } catch {
            return [];
        }
    }

    ToGeoJson(polygons: PolygonRings[], decimals = 7): GeoJsonMultiPolygon {
        const factor = 10 ** decimals;
        const round = (value: number) => Math.round(value * factor) / factor;
        return {
            type: "MultiPolygon",
            coordinates: polygons.map((rings) => rings.map((ring) => ring.map(([x, y]) => [round(x), round(y)]))),
        };
    }

    Projector(originLatitude: number, originLongitude: number) {
        const cosLat = Math.cos(originLatitude * RAD);
        return {
            toLocal: (longitude: number, latitude: number): LocalPoint => ({
                x: (longitude - originLongitude) * RAD * EARTH_RADIUS_M * cosLat,
                y: (latitude - originLatitude) * RAD * EARTH_RADIUS_M,
            }),
            toGeo: (point: LocalPoint) => ({
                longitude: originLongitude + point.x / (RAD * EARTH_RADIUS_M * cosLat),
                latitude: originLatitude + point.y / (RAD * EARTH_RADIUS_M),
            }),
        };
    }


    SignedArea(ring: LocalPoint[]): number {
        let sum = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            sum += ring[j]!.x * ring[i]!.y - ring[i]!.x * ring[j]!.y;
        }
        return sum / 2;
    }

    ConvexHull(points: LocalPoint[]): LocalPoint[] {
        const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
        if (sorted.length < 3) return sorted;
        const cross = (o: LocalPoint, a: LocalPoint, b: LocalPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower: LocalPoint[] = [];
        for (const point of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
            lower.push(point);
        }
        const upper: LocalPoint[] = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const point = sorted[i]!;
            while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
            upper.push(point);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }


    MinimumRectangle(points: LocalPoint[]): { width: number; depth: number } {
        const hull = this.ConvexHull(points);
        if (hull.length < 3) return { width: 0, depth: 0 };

        let best = { area: Infinity, width: 0, depth: 0 };
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i]!;
            const b = hull[(i + 1) % hull.length]!;
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length === 0) continue;
            const ux = (b.x - a.x) / length;
            const uy = (b.y - a.y) / length;

            let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
            for (const p of hull) {
                const u = p.x * ux + p.y * uy;
                const v = -p.x * uy + p.y * ux;
                minU = Math.min(minU, u); maxU = Math.max(maxU, u);
                minV = Math.min(minV, v); maxV = Math.max(maxV, v);
            }
            const sideU = maxU - minU;
            const sideV = maxV - minV;
            if (sideU * sideV < best.area) {
                best = { area: sideU * sideV, width: Math.min(sideU, sideV), depth: Math.max(sideU, sideV) };
            }
        }
        return { width: best.width, depth: best.depth };
    }

    PointInRings(point: LocalPoint, rings: LocalPoint[][]): boolean {
        let inside = false;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const a = ring[i]!;
                const b = ring[j]!;
                if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
                    inside = !inside;
                }
            }
        }
        return inside;
    }

    SegmentInsideIntervals(start: LocalPoint, end: LocalPoint, rings: LocalPoint[][]): [number, number][] {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const cuts = [0, 1];

        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const a = ring[j]!;
                const b = ring[i]!;
                const ex = b.x - a.x;
                const ey = b.y - a.y;
                const denominator = dx * ey - dy * ex;
                if (Math.abs(denominator) < 1e-12) continue;
                const t = ((a.x - start.x) * ey - (a.y - start.y) * ex) / denominator;
                const u = ((a.x - start.x) * dy - (a.y - start.y) * dx) / denominator;
                if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
            }
        }

        cuts.sort((a, b) => a - b);
        const intervals: [number, number][] = [];
        for (let i = 0; i < cuts.length - 1; i++) {
            const t0 = cuts[i]!;
            const t1 = cuts[i + 1]!;
            if (t1 - t0 < 1e-9) continue;
            const middle = (t0 + t1) / 2;
            if (!this.PointInRings({ x: start.x + dx * middle, y: start.y + dy * middle }, rings)) continue;

            const last = intervals[intervals.length - 1];
            if (last && Math.abs(last[1] - t0) < 1e-9) last[1] = t1;
            else intervals.push([t0, t1]);
        }
        return intervals;
    }
}
