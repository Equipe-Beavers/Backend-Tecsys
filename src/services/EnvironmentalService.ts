import type { EstudoPonto } from "../interface/estudo-ponto.js";
import type { PropagationParameters } from "../interface/PropagationDTO.js";
import type { InstallCriterionDTO } from "../interface/InstallCriterionDTO.js";
import type { AntenaSiteDTO } from "../interface/antena.js";
import type { BuildingsAround } from "./BuildingService.js";
import { PropagationUtils } from "../utils/PropagationUtils.js";

/**
 * Camadas ANALITICAS: SRTM (elevacao) e poligonos OSM (vegetacao).
 * O WMS ESA WorldCover usado na interface e somente uma imagem, nao um DEM
 * nem uma fonte validada para obter perda de sinal em dB.
 * As constantes de perda abaixo sao heuristicas para planejamento preliminar;
 * devem ser calibradas para banda, tecnologia, sazonalidade e local da instalacao.
 */
const TERRAIN_URL = process.env.ENV_ELEVATION_API_URL || "https://api.opentopodata.org/v1/srtm90m";
const OVERPASS_URL = process.env.ENV_OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const TTL_MS = 30 * 60_000;
const MAX_BBOX_DEG = 0.15; // limite de volume/custo dos servicos publicos
const TREE_DB_PER_M = 0.045;
const SCRUB_DB_PER_M = 0.012;
const CROPS_DB_PER_M = 0.005;
const MAX_VEGETATION_LOSS_DB = 24;
const MAX_TERRAIN_LOSS_DB = 30;
const utils = new PropagationUtils();

type SourceState = "disponivel" | "parcial" | "indisponivel";
type CoverKind = "arvores" | "arbustos" | "cultivo" | "gramineas" | "agua" | "pantano";
type Coord = { latitude: number; longitude: number };
type Box = { south: number; west: number; north: number; east: number };
type LandPolygon = { kind: CoverKind; ring: Array<[number, number]>; box: Box };

export interface EnvironmentalSummary {
  fontes: { relevo: SourceState; vegetacao: SourceState; antenas: SourceState; edificacoes: SourceState };
  dados_relevo: string;
  dados_vegetacao: string;
  antenas_identificadas: number | null;
  candidatos_excluidos: Array<{ id_estudo_ponto: number; motivos: string[] }>;
  avisos: string[];
}

export interface EnvironmentalLoss {
  relevo_db: number;
  vegetacao_db: number;
}

export interface CandidateDecision {
  eligible: boolean;
  reasons: string[];
  bonus: number;
}

function bounded(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function numeric(v: unknown): number | null {
  const n = v === null || v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}
function bbox(points: Coord[], pad = 0.003): Box {
  return {
    south: Math.max(-89.9, Math.min(...points.map(p => p.latitude)) - pad),
    north: Math.min(89.9, Math.max(...points.map(p => p.latitude)) + pad),
    west: Math.max(-179.9, Math.min(...points.map(p => p.longitude)) - pad),
    east: Math.min(179.9, Math.max(...points.map(p => p.longitude)) + pad),
  };
}
function insideBox(b: Box, lat: number, lon: number) {
  return lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
}
function pointInsideRing(lat: number, lon: number, ring: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > lat) !== (b[1] > lat) &&
      lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Grid amostrado em SRTM; 'null' representa ausencia de informacao, nunca altitude zero. */
export class TerrainGrid {
  constructor(readonly box: Box, readonly side: number, readonly values: Array<number | null>) {}

  height(lat: number, lon: number): number | null {
    if (!insideBox(this.box, lat, lon)) return null;
    const x = (lon - this.box.west) / (this.box.east - this.box.west) * (this.side - 1);
    const y = (this.box.north - lat) / (this.box.north - this.box.south) * (this.side - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(this.side - 1, x0 + 1), y1 = Math.min(this.side - 1, y0 + 1);
    const a = this.values[y0 * this.side + x0], b = this.values[y0 * this.side + x1];
    const c = this.values[y1 * this.side + x0], d = this.values[y1 * this.side + x1];
    // Se qualquer amostra for nula, nao inventar altitude intermediaria.
    if (a == null || b == null || c == null || d == null) return null;
    const tx = x - x0, ty = y - y0;
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  slopeDeg(lat: number, lon: number): number | null {
    const step = 60; // diferencas finitas localmente, amostradas no DEM interpolado
    const dy = step / 111_320;
    const dx = dy / Math.max(0.1, Math.cos(lat * Math.PI / 180));
    const n = this.height(lat + dy, lon), s = this.height(lat - dy, lon);
    const w = this.height(lat, lon - dx), e = this.height(lat, lon + dx);
    if (n == null || s == null || w == null || e == null) return null;
    return Math.atan(Math.hypot((e - w) / (2 * step), (n - s) / (2 * step))) * 180 / Math.PI;
  }
}

/** OSM nao cobre todos os terrenos. 'undefined' significa dado desconhecido. */
export class VegetationGrid {
  private cells: Array<CoverKind | undefined>;
  constructor(readonly box: Box, readonly side: number, polygons: LandPolygon[]) {
    this.cells = new Array(side * side);
    for (const polygon of polygons) {
      const x0 = bounded(Math.floor((polygon.box.west - box.west) / (box.east - box.west) * side), 0, side - 1);
      const x1 = bounded(Math.ceil((polygon.box.east - box.west) / (box.east - box.west) * side), 0, side - 1);
      const y0 = bounded(Math.floor((box.north - polygon.box.north) / (box.north - box.south) * side), 0, side - 1);
      const y1 = bounded(Math.ceil((box.north - polygon.box.south) / (box.north - box.south) * side), 0, side - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const lat = box.north - (y + 0.5) / side * (box.north - box.south);
        const lon = box.west + (x + 0.5) / side * (box.east - box.west);
        if (insideBox(polygon.box, lat, lon) && pointInsideRing(lat, lon, polygon.ring)) {
          const i = y * side + x;
          // Arvores tem precedencia se ha poligonos sobrepostos.
          if (polygon.kind === "arvores" || !this.cells[i]) this.cells[i] = polygon.kind;
        }
      }
    }
  }

  at(lat: number, lon: number): CoverKind | undefined {
    if (!insideBox(this.box, lat, lon)) return undefined;
    const x = bounded(Math.floor((lon - this.box.west) / (this.box.east - this.box.west) * this.side), 0, this.side - 1);
    const y = bounded(Math.floor((this.box.north - lat) / (this.box.north - this.box.south) * this.side), 0, this.side - 1);
    return this.cells[y * this.side + x];
  }
}

export class EnvironmentalContext {
  readonly summary: EnvironmentalSummary;

  constructor(
    readonly terrain: TerrainGrid | null,
    readonly vegetation: VegetationGrid | null,
    readonly antennas: AntenaSiteDTO[] | null,
    private readonly pointElevations = new Map<number, number>(),
    notes: string[] = [],
  ) {
    this.summary = {
      fontes: {
        relevo: terrain || pointElevations.size ? "disponivel" : "indisponivel",
        vegetacao: vegetation ? "disponivel" : "indisponivel",
        antenas: antennas ? "disponivel" : "indisponivel",
        edificacoes: "indisponivel",
      },
      dados_relevo: terrain ? "SRTM90m amostrado (grade de 10x10, resolucao variavel)" : pointElevations.size ? "altitudes declaradas nos pontos, sem perfil entre eles" : "sem dados",
      dados_vegetacao: vegetation ? "poligonos OpenStreetMap (cobertura parcial, perda heuristica)" : "sem dados",
      antenas_identificadas: antennas?.length ?? null,
      candidatos_excluidos: [],
      avisos: notes,
    };
  }

  private altitude(p: Coord & { id_estudo_ponto?: number; relevo_m?: number | null }): number | null {
    if (p.id_estudo_ponto != null && this.pointElevations.has(p.id_estudo_ponto)) return this.pointElevations.get(p.id_estudo_ponto)!;
    return this.terrain?.height(p.latitude, p.longitude) ?? null;
  }

  checkCandidate(p: EstudoPonto, criteria: Partial<InstallCriterionDTO> | null, others: EstudoPonto[], buildings: BuildingsAround | null): CandidateDecision {
    const reasons: string[] = [];
    const allowed = criteria?.tipos_elementos_permitidos;
    const blocked = criteria?.tipos_elementos_proibidos;
    const type = p.tipo_ativo?.trim().toUpperCase() ?? "";
    if (Array.isArray(allowed) && allowed.length && !allowed.includes(type)) reasons.push("tipo de ativo nao permitido pelo criterio");
    if (Array.isArray(blocked) && blocked.includes(type)) reasons.push("tipo de ativo proibido pelo criterio");

    const limits = criteria?.relevo;
    if (limits && typeof limits === "object" && !Array.isArray(limits)) {
      const l = limits as Record<string, unknown>;
      const altitude = this.altitude(p);
      const minimum = numeric(l.altitude_minima_m), maximum = numeric(l.altitude_maxima_m);
      if (altitude != null && minimum != null && altitude < minimum) reasons.push("altitude abaixo do limite");
      if (altitude != null && maximum != null && altitude > maximum) reasons.push("altitude acima do limite");
      const maxSlope = numeric(l.declividade_maxima_graus);
      const slope = this.terrain?.slopeDeg(p.latitude, p.longitude);
      if (maxSlope != null && slope != null && slope > maxSlope) reasons.push("declividade acima do limite");
    }
    const near = others.filter(other => other.id_estudo_ponto !== p.id_estudo_ponto);
    const nearest = near.length ? Math.min(...near.map(other => utils.MetersDistance(p.latitude, p.longitude, other.latitude, other.longitude))) : null;
    if (nearest != null) {
      const minimum = numeric(criteria?.distancia_minima_ativos_m), maximum = numeric(criteria?.distancia_maxima_ativos_m);
      if (minimum != null && nearest < minimum) reasons.push("distancia abaixo do minimo a outros ativos");
      if (maximum != null && nearest > maximum) reasons.push("distancia acima do maximo a outros ativos");
    }
    if (buildings?.index?.containsPoint(p.latitude, p.longitude) && p.atributos?.instalacao_em_edificacao_autorizada !== true) {
      reasons.push("ponto no interior de edificacao sem instalacao autorizada");
    }
    const cover = this.vegetation?.at(p.latitude, p.longitude);
    if (cover === "agua" || cover === "pantano") reasons.push("ponto sobre agua ou area umida mapeada");

    const colocated = this.antennas?.some(a => utils.MetersDistance(p.latitude, p.longitude, a.latitude, a.longitude) <= 40) ?? false;
    // Proximidade de uma torre nao prova direito de uso nem compatibilidade RF.
    return { eligible: reasons.length === 0, reasons, bonus: colocated ? 0.15 : 0 };
  }

  loss(origin: Coord & { relevo_m?: number | null; id_estudo_ponto?: number }, dest: Coord & { relevo_m?: number | null; id_estudo_ponto?: number }, distanceM: number, params: PropagationParameters): EnvironmentalLoss {
    if (distanceM < 1) return { relevo_db: 0, vegetacao_db: 0 };
    let vegetationLoss = 0;
    const steps = Math.min(70, Math.max(4, Math.ceil(distanceM / 100)));
    const sampleLength = distanceM / steps;
    if (this.vegetation) {
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const kind = this.vegetation.at(origin.latitude + (dest.latitude - origin.latitude) * t, origin.longitude + (dest.longitude - origin.longitude) * t);
        const rate = kind === "arvores" ? TREE_DB_PER_M : kind === "arbustos" ? SCRUB_DB_PER_M : kind === "cultivo" ? CROPS_DB_PER_M : kind === "gramineas" ? 0.002 : 0;
        vegetationLoss += sampleLength * rate;
      }
    }
    vegetationLoss = Math.min(MAX_VEGETATION_LOSS_DB, vegetationLoss);

    const a = this.altitude(origin), b = this.altitude(dest);
    let highestV = -Infinity;
    if (this.terrain && a != null && b != null) {
      const wavelength = 299.792458 / params.frequencyMhz;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const h = this.terrain.height(origin.latitude + (dest.latitude - origin.latitude) * t, origin.longitude + (dest.longitude - origin.longitude) * t);
        if (h == null) continue;
        const d1 = distanceM * t, d2 = distanceM - d1;
        const los = a + params.gatewayHeightM + (b + params.deviceHeightM - a - params.gatewayHeightM) * t;
        const earthBulge = d1 * d2 / (2 * (4 / 3) * 6_371_000);
        const v = (h + earthBulge - los) * Math.sqrt(2 * distanceM / (wavelength * d1 * d2));
        highestV = Math.max(highestV, v);
      }
    }
    const terrainLoss = Number.isFinite(highestV) ? Math.min(MAX_TERRAIN_LOSS_DB, utils.KnifeEdgeLossDb(highestV)) : 0;
    return { relevo_db: utils.Round1(terrainLoss), vegetacao_db: utils.Round1(vegetationLoss) };
  }
}

function kindFor(tags: Record<string, string>): CoverKind | null {
  if (tags.natural === "water") return "agua";
  if (tags.natural === "wetland") return "pantano";
  if (tags.natural === "wood" || tags.landuse === "forest") return "arvores";
  if (tags.natural === "scrub") return "arbustos";
  if (tags.natural === "grassland" || tags.landuse === "meadow") return "gramineas";
  if (["orchard", "farmland", "vineyard"].includes(tags.landuse ?? "")) return "cultivo";
  return null; // desconhecido, nao assumir ausencia de vegetacao
}

export class EnvironmentalService {
  private static readonly cache = new Map<string, { expires: number; context: EnvironmentalContext }>();

  async prepare(points: EstudoPonto[]): Promise<EnvironmentalContext> {
    const elevations = new Map<number, number>();
    for (const p of points) {
      const z = numeric(p.relevo_m);
      if (z != null) elevations.set(p.id_estudo_ponto, z);
    }
    if (points.length === 0) return new EnvironmentalContext(null, null, null, elevations);
    const area = bbox(points);
    const key = [area.south, area.west, area.north, area.east].map(n => n.toFixed(5)).join(":");
    const hit = EnvironmentalService.cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return new EnvironmentalContext(hit.context.terrain, hit.context.vegetation, hit.context.antennas, elevations, [...hit.context.summary.avisos]);
    }
    const notes: string[] = [];
    if (area.north - area.south > MAX_BBOX_DEG || area.east - area.west > MAX_BBOX_DEG) {
      notes.push("Regiao grande demais para consulta automatica a APIs publicas; fontes ambientais omitidas.");
      return new EnvironmentalContext(null, null, null, elevations, notes);
    }
    const [terrain, vegetation, antennas] = await Promise.all([
      this.loadTerrain(area).catch((e: unknown) => { notes.push(`SRTM indisponivel: ${String(e)}`); return null; }),
      this.loadVegetation(area).catch((e: unknown) => { notes.push(`OSM indisponivel: ${String(e)}`); return null; }),
      import("../modules/repository/AntenasRepository.js")
        .then(({ AntenasRepository }) => new AntenasRepository().listarPorArea({
          minLatitude: area.south, maxLatitude: area.north,
          minLongitude: area.west, maxLongitude: area.east,
        }, 3000))
        .then(response => response.total <= 3000 ? response.data : null)
        .catch((e: unknown) => { notes.push(`ANATEL indisponivel: ${String(e)}`); return null; }),
    ]);
    if (antennas == null) notes.push("Antenas: limite de consulta ou fonte indisponivel; nao inferir inexistencia de antenas.");
    if (vegetation) notes.push("Vegetacao OSM nao exaustiva; coeficientes de atenuacao sao heuristicas, nao ITU-R P.833 calibrada.");
    const context = new EnvironmentalContext(terrain, vegetation, antennas, elevations, notes);
    EnvironmentalService.cache.set(key, { expires: Date.now() + TTL_MS, context });
    if (EnvironmentalService.cache.size > 16) EnvironmentalService.cache.delete(EnvironmentalService.cache.keys().next().value!);
    return context;
  }

  private async loadTerrain(area: Box): Promise<TerrainGrid> {
    const side = 10; // 100 pontos, limite por chamada da instancia publica do OpenTopoData
    const locations: string[] = [];
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const lat = area.north - y / (side - 1) * (area.north - area.south);
      const lon = area.west + x / (side - 1) * (area.east - area.west);
      locations.push(`${lat.toFixed(6)},${lon.toFixed(6)}`);
    }
    // POST evita URL excessivamente longa para 100 coordenadas.
    const response = await fetch(TERRAIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: locations.join("|"), interpolation: "bilinear" }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json() as { results?: Array<{ elevation: number | null }> };
    if (!Array.isArray(json.results) || json.results.length !== locations.length) throw new Error("Resposta SRTM incompleta");
    const values = json.results.map(r => numeric(r.elevation));
    if (!values.some(v => v != null)) throw new Error("Sem elevacoes para a regiao");
    return new TerrainGrid(area, side, values);
  }

  private async loadVegetation(area: Box): Promise<VegetationGrid> {
    const b = `${area.south},${area.west},${area.north},${area.east}`;
    const query = `[out:json][timeout:15];(way["natural"~"^(wood|scrub|grassland|wetland|water)$"](${b});way["landuse"~"^(forest|orchard|farmland|vineyard|meadow)$"](${b}););out geom;`;
    const response = await fetch(OVERPASS_URL, {
      method: "POST", body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json() as { elements?: Array<{ tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }> };
    if (!Array.isArray(json.elements)) throw new Error("Resposta OSM invalida");
    const polygons: LandPolygon[] = [];
    for (const element of json.elements) {
      const kind = kindFor(element.tags ?? {});
      const points = element.geometry;
      if (!kind || !points || points.length < 4 || points.length > 10000) continue;
      const first = points[0]!, last = points[points.length - 1]!;
      if (Math.abs(first.lat - last.lat) > 1e-6 || Math.abs(first.lon - last.lon) > 1e-6) continue;
      const ring = points.map(p => [p.lon, p.lat] as [number, number]);
      const region = bbox(points.map(p => ({ latitude: p.lat, longitude: p.lon })), 0);
      polygons.push({ kind, ring, box: region });
      if (polygons.length >= 3500) break;
    }
    // Mesmo resposta vazia indica consulta concluida, NAO confirma que nao existe vegetacao.
    return new VegetationGrid(area, 96, polygons);
  }
}
