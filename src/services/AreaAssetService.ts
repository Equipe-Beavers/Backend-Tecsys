import { pool } from '../database/pool.js';

export interface AreaAssetInput {
  geom: { type: 'Polygon'; coordinates: number[][][] };
  distribuidora?: string;
}

// Conta todos os registros atuais, sem quotas de marcadores ou filtro de camada.
export class AreaAssetService {
  async count(input: AreaAssetInput): Promise<number> {
    const ring = input.geom.coordinates[0]!;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) throw new RangeError('O polígono deve estar fechado.');
    const counts = ['postes', 'subestacoes', 'dispositivos'].map(table => `
      (SELECT count(*) FROM ${table} a
       JOIN posicoes_geograficas p ON p.id_posicao = a.id_posicao
       JOIN distribuidoras d ON d.id = p.id_distribuidora
       WHERE a.registro_atual AND p.registro_atual
         AND ($2::text IS NULL OR d.nome = $2)
         AND p.longitude BETWEEN $3 AND $5 AND p.latitude BETWEEN $4 AND $6
         AND ST_Covers(area.geom, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)))
    `).join(' + ');
    const { rows } = await pool.query<{ valida: boolean; total: number | null }>(`
      WITH area AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom)
      SELECT ST_IsValid(geom) AND ST_Area(geom) > 0 AS valida,
        CASE WHEN ST_IsValid(geom) AND ST_Area(geom) > 0
          THEN (${counts})::int ELSE NULL END AS total
      FROM area`, [JSON.stringify(input.geom), input.distribuidora?.trim() || null,
      Math.min(...ring.map(p => p[0]!)), Math.min(...ring.map(p => p[1]!)),
      Math.max(...ring.map(p => p[0]!)), Math.max(...ring.map(p => p[1]!))]);
    if (!rows[0]?.valida) throw new RangeError('Desenhe um polígono válido com área maior que zero.');
    return Number(rows[0].total);
  }
}
