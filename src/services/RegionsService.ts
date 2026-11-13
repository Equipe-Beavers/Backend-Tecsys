import { pool } from "../database/pool.js";
import type {
  BairroDTO,
  BoundingBox,
  DistribuidoraDTO,
  DistribuidoraLocal,
  EstadoDTO,
  MunicipioDTO,
  PaginatedResult,
} from "../interface/region-repository.js";
import { RegionsUtils } from "../utils/RegionsUtils.js";

const ATIVOS_CTE = `
  WITH ativos AS (
    SELECT
      pos.id_posicao,
      pos.municipio,
      pos.bairro,
      pos.latitude,
      pos.longitude,
      pos.id_distribuidora,
      pos.registro_atual
    FROM POSICOES_GEOGRAFICAS pos
    WHERE pos.registro_atual = TRUE
      AND (
        EXISTS (
          SELECT 1 FROM POSTES a
          WHERE a.id_posicao = pos.id_posicao AND a.registro_atual = TRUE
        )
        OR EXISTS (
          SELECT 1 FROM SUBESTACOES a
          WHERE a.id_posicao = pos.id_posicao AND a.registro_atual = TRUE
        )
        OR EXISTS (
          SELECT 1 FROM DISPOSITIVOS a
          WHERE a.id_posicao = pos.id_posicao AND a.registro_atual = TRUE
        )
      )
  )
`;

export class RegionsService {
  private regionsUtils: RegionsUtils;

  constructor() {
    this.regionsUtils = new RegionsUtils();
  }

  private mapMunRows(row: {
    nome: string;
    uf: string;
    total_ativos: number | string;
    lat: number | null;
    lng: number | null;
  }): MunicipioDTO {
    return {
      nome: row.nome,
      uf: row.uf,
      totalAtivos: Number(row.total_ativos),
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
    };
  }

  private mapBairroRow(row: {
    nome: string;
    uf: string | null;
    municipio: string;
    total_ativos: number | string;
  }): BairroDTO {
    return {
      nome: row.nome,
      uf: row.uf,
      municipio: row.municipio,
      totalAtivos: Number(row.total_ativos),
    };
  }

  private mapStateRow(row: {
    uf: string;
    total_municipios: number | string;
    total_ativos: number | string;
  }): EstadoDTO {
    return {
      uf: row.uf,
      totalMunicipios: Number(row.total_municipios),
      totalAtivos: Number(row.total_ativos),
    };
  }

  private async municipios(params: {
    distribuidora?: string;
    uf?: string;
    busca?: string;
    limite: number;
    pagina: number;
    bbox?: BoundingBox;
  }): Promise<PaginatedResult<MunicipioDTO>> {
    const values: unknown[] = [];
    const conditions: string[] = [
      "p.registro_atual = true",
      "p.municipio IS NOT NULL",
      "p.municipio ~ '^[0-9]{7}$'",
    ];
    if (params.distribuidora?.trim()) {
      values.push(params.distribuidora.trim());
      conditions.push(`UPPER(d.nome) = UPPER($${values.length})`);
    }

    if (params.uf?.trim()) {
      values.push(params.uf.trim().toUpperCase());
      conditions.push(`UPPER(m.uf) = $${values.length}`);
    }

    if (params.busca?.trim()) {
      values.push(`%${params.busca.trim()}%`);
      conditions.push(`m.nome ILIKE $${values.length}`);
    }

    if (params.bbox) {
      values.push(params.bbox.minLat);
      const minLatParam = values.length;

      values.push(params.bbox.maxLat);
      const maxLatParam = values.length;

      values.push(params.bbox.minLng);
      const minLngParam = values.length;

      values.push(params.bbox.maxLng);
      const maxLngParam = values.length;

      conditions.push(
        `p.latitude BETWEEN $${minLatParam} AND $${maxLatParam}`,
        `p.longitude BETWEEN $${minLngParam} AND $${maxLngParam}`,
      );
    }

    const where = conditions.join(" AND ");
    const countResult = await pool.query<{ total: number }>(
      `
      ${ATIVOS_CTE}
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT m.codigo_ibge
        FROM ativos p
        JOIN municipios m
          ON m.codigo_ibge::text = p.municipio
        LEFT JOIN distribuidoras d
          ON d.id = p.id_distribuidora
        WHERE ${where}
        GROUP BY m.codigo_ibge
      ) AS agrupados
      `,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    const inicio = (params.pagina - 1) * params.limite;
    const dataValues = [...values, params.limite, inicio];
    const limiteParam = dataValues.length - 1;
    const offsetParam = dataValues.length;

    const result = await pool.query<{
      nome: string;
      uf: string;
      total_ativos: number;
      lat: number | null;
      lng: number | null;
    }>(
      `
      ${ATIVOS_CTE}
      SELECT
        m.nome,
        m.uf,
        COUNT(p.id_posicao)::int AS total_ativos,
        AVG(p.latitude) AS lat,
        AVG(p.longitude) AS lng
      FROM ativos p
      JOIN municipios m
        ON m.codigo_ibge::text = p.municipio
      LEFT JOIN distribuidoras d
        ON d.id = p.id_distribuidora
      WHERE ${where}
      GROUP BY m.codigo_ibge, m.nome, m.uf
      ORDER BY m.nome
      LIMIT $${limiteParam}
      OFFSET $${offsetParam}
      `,
      dataValues,
    );

    return {
      dados: result.rows.map(this.mapMunRows),
      paginacao: {
        pagina: params.pagina,
        limite: params.limite,
        total,
        totalPaginas: Math.ceil(total / params.limite),
      },
    };
  }

  private distributorLocalsCache: { data: Map<string, DistribuidoraLocal>; expiresAt: number } | null = null;
  private static readonly distributorLocalsTtlMs = 5 * 60 * 1000;

  private async distributorLocals(): Promise<Map<string, DistribuidoraLocal>> {
    if (this.distributorLocalsCache && this.distributorLocalsCache.expiresAt > Date.now()) {
      return this.distributorLocalsCache.data;
    }

    try {
      const result = await pool.query<{
        nome: string;
        total_ativos: number;
        latitude: number | null;
        longitude: number | null;
      }>(
        `
            SELECT
            d.nome,
            COUNT(*)::int AS total_ativos,
            AVG(p.latitude) AS latitude,
            AVG(p.longitude) AS longitude
            FROM posicoes_geograficas p
            JOIN distribuidoras d ON d.id = p.id_distribuidora
            WHERE p.registro_atual = TRUE
              AND (
                EXISTS (
                  SELECT 1 FROM POSTES a
                  WHERE a.id_posicao = p.id_posicao AND a.registro_atual = TRUE
                )
                OR EXISTS (
                  SELECT 1 FROM SUBESTACOES a
                  WHERE a.id_posicao = p.id_posicao AND a.registro_atual = TRUE
                )
                OR EXISTS (
                  SELECT 1 FROM DISPOSITIVOS a
                  WHERE a.id_posicao = p.id_posicao AND a.registro_atual = TRUE
                )
              )
            GROUP BY d.id, d.nome
        `,
      );

      const map = new Map<string, DistribuidoraLocal>();
      for (const row of result.rows) {
        map.set(this.regionsUtils.normalizeName(row.nome), {
          nome: row.nome,
          totalAtivos: Number(row.total_ativos),
          latitude: row.latitude === null ? null : Number(row.latitude),
          longitude: row.longitude === null ? null : Number(row.longitude),
        });
      }
      this.distributorLocalsCache = {
        data: map,
        expiresAt: Date.now() + RegionsService.distributorLocalsTtlMs,
      };
      return map;
    } catch (error: any) {
      return new Map();
    }
  }

  async distributorName(distributorID: number): Promise<string | undefined> {
    const result = await pool.query<{ nome: string }>(
      "SELECT nome FROM distribuidoras WHERE id = $1",
      [distributorID],
    );
    return result.rows[0]?.nome;
  }

  async listDistributors(busca?: string): Promise<DistribuidoraDTO[]> {
    const query = `SELECT id, nome, uf, ano_bdgd FROM distribuidoras;`;
    const termo = busca?.trim().toLocaleLowerCase();
    const [result, locals] = await Promise.all([
      pool.query(query),
      this.distributorLocals(),
    ]);

    const used = new Set<string>();
    const answer: DistribuidoraDTO[] = [];
    if (result.rows[0]) {
      for (const row of result.rows ?? []) {
        const name = String(row.nome);
        const key = this.regionsUtils.normalizeName(name);
        const local = locals.get(key);
        used.add(key);

        answer.push({
          id: Number(row.id),
          nome: local?.nome ?? name,
          uf: row.uf ?? null,
          anoBdgd: row.ano_bdgd == null ? null : Number(row.ano_bdgd),
          totalAtivos: local?.totalAtivos ?? 0,
          latitude: local?.latitude ?? null,
          longitude: local?.longitude ?? null,
        });
      }
    }

    for (const [key, local] of locals) {
      if (used.has(key)) continue;
      answer.push({
        id: 0,
        nome: local.nome,
        uf: null,
        anoBdgd: null,
        totalAtivos: local.totalAtivos,
        latitude: local.latitude,
        longitude: local.longitude,
      });
    }

    answer.sort((a, b) => {
      if (a.totalAtivos !== b.totalAtivos) return b.totalAtivos - a.totalAtivos;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return answer.filter(
      (distribuidora) =>
        !termo || distribuidora.nome.toLocaleLowerCase().includes(termo),
    );
  }

  async listMunicipio(params: {
    distribuidora?: string;
    uf?: string;
    busca?: string;
    limite: number;
    pagina: number;
    bbox?: BoundingBox;
  }): Promise<PaginatedResult<MunicipioDTO>> {
    return this.municipios(params);
  }

  async findGlobalMun(params: {
    busca?: string;
    uf?: string;
    limite: number;
    pagina: number;
    bbox?: BoundingBox;
  }): Promise<PaginatedResult<MunicipioDTO>> {
    return this.municipios(params);
  }

  async listStates(busca?: string): Promise<EstadoDTO[]> {
    const values: unknown[] = [];
    let filtro = "";

    const termo = busca?.trim();
    if (termo) {
      values.push(`%${termo}%`);
      filtro = `AND (m.uf ILIKE $${values.length} OR m.nome ILIKE $${values.length})`;
    }

    const result = await pool.query<{
      uf: string;
      total_municipios: number;
      total_ativos: number;
    }>(
      `
        ${ATIVOS_CTE}
        SELECT
          m.uf,
          COUNT(DISTINCT m.codigo_ibge)::int AS total_municipios,
          COUNT(p.id_posicao)::int AS total_ativos
        FROM ativos p
        JOIN municipios m
          ON m.codigo_ibge::text = p.municipio
        WHERE p.registro_atual = TRUE
          AND p.municipio ~ '^[0-9]{7}$'
          ${filtro}
        GROUP BY m.uf
        ORDER BY m.uf
      `,
      values,
    );
    return result.rows.map(this.mapStateRow);
  }

  async listNeighborhood(params: {
    distribuidora?: string;
    municipio?: string;
    busca?: string;
    limite: number;
    pagina: number;
  }): Promise<PaginatedResult<BairroDTO>> {
    const values: unknown[] = [];
    const conditions = [
      "p.registro_atual = TRUE",
      "p.bairro IS NOT NULL",
      "p.bairro <> ''",
      "p.municipio ~ '^[0-9]{7}$'",
    ];

    if (params.distribuidora?.trim()) {
      values.push(params.distribuidora.trim());
      conditions.push(`UPPER(d.nome) = UPPER($${values.length})`);
    }
    if (params.municipio?.trim()) {
      values.push(params.municipio.trim());
      conditions.push(`m.nome ILIKE $${values.length}`);
    }
    if (params.busca?.trim()) {
      values.push(`%${params.busca.trim()}%`);
      conditions.push(`p.bairro ILIKE $${values.length}`);
    }

    const where = conditions.join(" AND ");

    const countResult = await pool.query<{ total: number }>(
      `
      ${ATIVOS_CTE}
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT p.bairro, m.codigo_ibge
        FROM ativos p
        JOIN municipios m
          ON m.codigo_ibge::text = p.municipio
        LEFT JOIN distribuidoras d
          ON d.id = p.id_distribuidora
        WHERE ${where}
        GROUP BY p.bairro, m.codigo_ibge
      ) AS agrupados
      `,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    const inicio = (params.pagina - 1) * params.limite;

    const dataValues = [...values, params.limite, inicio];
    const limiteParam = dataValues.length - 1;
    const offsetParam = dataValues.length;

    const result = await pool.query<{
      nome: string;
      uf: string | null;
      municipio: string;
      total_ativos: number;
    }>(
      `
      ${ATIVOS_CTE}
      SELECT
        p.bairro AS nome,
        m.uf,
        m.nome AS municipio,
        COUNT(p.id_posicao)::int AS total_ativos
      FROM ativos p
      JOIN municipios m
        ON m.codigo_ibge::text = p.municipio
      LEFT JOIN distribuidoras d
        ON d.id = p.id_distribuidora
      WHERE ${where}
      GROUP BY p.bairro, m.uf, m.nome
      ORDER BY p.bairro
      LIMIT $${limiteParam}
      OFFSET $${offsetParam}
      `,
      dataValues,
    );

    return {
      dados: result.rows.map(this.mapBairroRow),
      paginacao: {
        pagina: params.pagina,
        limite: params.limite,
        total,
        totalPaginas: Math.ceil(total / params.limite),
      },
    };
  }
}
