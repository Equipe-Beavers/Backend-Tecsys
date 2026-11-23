import { fromUrl } from "geotiff";

export type WorldCoverKind = "arvores" | "arbustos" | "cultivo" |
  "gramineas" | "agua" | "pantano" | "sem_perda_modelada";
export type WorldCoverBox = { south: number; west: number; north: number; east: number };

type Raster = {
  west: number; north: number; dx: number; dy: number;
  width: number; height: number; pixels: Uint8Array;
};

const ROOT = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/";
const CLASSES: Record<number, WorldCoverKind> = {
  10: "arvores", 20: "arbustos", 30: "gramineas", 40: "cultivo",
  50: "sem_perda_modelada", 60: "sem_perda_modelada", 70: "sem_perda_modelada",
  80: "agua", 90: "pantano", 95: "arvores", 100: "sem_perda_modelada",
};

export function worldCoverTile(lat: number, lon: number): string {
  return `${lat < 0 ? "S" : "N"}${String(Math.abs(lat)).padStart(2, "0")}` +
    `${lon < 0 ? "W" : "E"}${String(Math.abs(lon)).padStart(3, "0")}`;
}

export class WorldCoverGrid {
  constructor(private readonly rasters: Raster[], readonly partial: boolean) {}

  at(lat: number, lon: number): WorldCoverKind | undefined {
    for (const r of this.rasters) {
      const x = Math.floor((lon - r.west) / r.dx);
      const y = Math.floor((r.north - lat) / r.dy);
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue;
      const code = r.pixels[y * r.width + x];
      if (code !== undefined && CLASSES[code]) return CLASSES[code];
    }
    return undefined;
  }
}

export async function loadWorldCover(area: WorldCoverBox, clipped = false): Promise<WorldCoverGrid> {
  const rasters: Raster[] = [];
  let missing = clipped;
  let valid = 0;
  const counts: Record<number, number> = {};
  for (let lat = Math.floor(area.south / 3) * 3; lat < area.north; lat += 3) {
    for (let lon = Math.floor(area.west / 3) * 3; lon < area.east; lon += 3) {
      const tile = worldCoverTile(lat, lon);
      try {
        const url = `${ROOT}ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`;
        const signal = AbortSignal.timeout(30000);
        const tiff = await fromUrl(url, { allowFullFile: false, maxRanges: 0 }, signal);
        const image = await tiff.getImage(0);
        const [west, south, east, north] = image.getBoundingBox();
        if (west == null || south == null || east == null || north == null) {
          throw new Error("GeoTIFF sem limites geograficos");
        }
        const w = image.getWidth(), h = image.getHeight();
        const dx = (east - west) / w, dy = (north - south) / h;
        if (!(dx > 0 && dy > 0)) throw new Error("Resolucao invalida");
        const x0 = Math.max(0, Math.floor((area.west - west) / dx));
        const y0 = Math.max(0, Math.floor((north - area.north) / dy));
        const x1 = Math.min(w, Math.ceil((area.east - west) / dx));
        const y1 = Math.min(h, Math.ceil((north - area.south) / dy));
        if (x1 <= x0 || y1 <= y0) continue;
        const data = await image.readRasters({
          window: [x0, y0, x1, y1], samples: [0], interleave: true, signal,
        });
        if (!(data instanceof Uint8Array)) throw new Error("Raster de classes nao e uint8");
        const pixels = data;
        if (pixels.length !== (x1 - x0) * (y1 - y0)) throw new Error("Raster incompleto");
        for (const code of pixels) {
          if (CLASSES[code]) { valid++; counts[code] = (counts[code] ?? 0) + 1; }
          else missing = true;
        }
        rasters.push({ west: west + x0 * dx, north: north - y0 * dy,
          dx, dy, width: x1 - x0, height: y1 - y0, pixels });
      } catch (error) {
        missing = true;
        console.warn(`[WorldCover] ${tile}:`, error);
      }
    }
  }
  if (valid === 0) throw new Error("WorldCover sem pixels validos na regiao");
  console.info("[WorldCover] Classes carregadas:", counts);
  return new WorldCoverGrid(rasters, missing);
}
