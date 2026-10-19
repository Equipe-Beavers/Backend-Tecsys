import { pool } from "../../database/pool.js";
import type {
    AntenasBoundingBox,
    AntenasListResponse,
    AntenaSiteDTO,
} from "../../interface/antena.js";

interface AntenaAgrupadaRow {
    id: string;
    nome_entidade: string | null;
    municipio: string | null;
    uf: string | null;
    latitude: number;
    longitude: number;
    total_registros: number;
    tecnologias: string[] | null;
    tipo_estacao: string | null;
    altura_antena_media_m: number | null;
}

export class AntenasRepository {
    async listarPorArea(
        bbox: AntenasBoundingBox,
        limit: number,
    ): Promise<AntenasListResponse> {
        const values = [
            bbox.minLongitude,
            bbox.minLatitude,
            bbox.maxLongitude,
            bbox.maxLatitude,
        ];

        const filtradasSql = `
            SELECT id, entidade, municipio, uf, latitude, longitude,
                   tecnologia, tipo_estacao, altura_antena_m
            FROM antenas_anatel
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4674)
              AND latitude BETWEEN $2 AND $4
              AND longitude BETWEEN $1 AND $3
        `;

        const agrupadasSql = `
            SELECT
                MIN(id)::text AS id,
                NULLIF(MAX(entidade), '') AS nome_entidade,
                NULLIF(MAX(municipio), '') AS municipio,
                NULLIF(MAX(uf), '') AS uf,
                ROUND(latitude::numeric, 6)::double precision AS latitude,
                ROUND(longitude::numeric, 6)::double precision AS longitude,
                COUNT(*)::int AS total_registros,
                COALESCE(
                    ARRAY_AGG(DISTINCT tecnologia)
                        FILTER (WHERE tecnologia IS NOT NULL AND BTRIM(tecnologia) <> ''),
                    ARRAY[]::text[]
                ) AS tecnologias,
                NULLIF(MAX(tipo_estacao), '') AS tipo_estacao,
                AVG(altura_antena_m)::double precision AS altura_antena_media_m
            FROM filtradas
            GROUP BY
                ROUND(latitude::numeric, 6),
                ROUND(longitude::numeric, 6),
                COALESCE(entidade, ''),
                COALESCE(municipio, ''),
                COALESCE(uf, '')
        `;

        const cte = `WITH filtradas AS (${filtradasSql}), agrupadas AS (${agrupadasSql})`;
        const totalResult = await pool.query<{ total: number }>(
            `${cte} SELECT COUNT(*)::int AS total FROM agrupadas`,
            values,
        );

        const dataResult = await pool.query<AntenaAgrupadaRow>(
            `${cte}
             SELECT * FROM agrupadas
             ORDER BY nome_entidade NULLS LAST, municipio NULLS LAST
             LIMIT $5`,
            [...values, limit],
        );

        const data: AntenaSiteDTO[] = dataResult.rows.map((row) => ({
            id: String(row.id),
            nomeEntidade: row.nome_entidade,
            municipio: row.municipio,
            uf: row.uf,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            totalRegistros: Number(row.total_registros),
            tecnologias: row.tecnologias ?? [],
            tipoEstacao: row.tipo_estacao,
            alturaAntenaMediaM:
                row.altura_antena_media_m == null
                    ? null
                    : Number(row.altura_antena_media_m),
        }));

        return {
            data,
            total: Number(totalResult.rows[0]?.total ?? 0),
        };
    }
}
