import { supabase } from "../../lib/supabase.js";
import { pool } from "../../database/pool.js";

export interface DistribuidoraDTO {
  id: number;
  nome: string;
  uf: string | null;
  anoBdgd: number | null;
  totalAtivos: number;
  latitude: number | null;
  longitude: number | null;
}

export interface MunicipioDTO {
  nome: string;
  uf: string | null;
  totalAtivos: number;
  lat: number | null;
  lng: number | null;
}

export interface EstadoDTO {
  uf: string;
  totalMunicipios: number;
  totalAtivos: number;
}

export interface BairroDTO {
  nome: string;
  uf: string | null;
  municipio: string | null;
  totalAtivos: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface PaginatedResult<T> {
  dados: T[];
  paginacao: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

function paginated<T>(
  rows: Array<T & { total: string | number }>,
  pagina: number,
  limite: number,
): PaginatedResult<T> {
  const total = Number(rows[0]?.total ?? 0);

  return {
    dados: rows.map(({ total: _total, ...row }) => row as T),
    paginacao: {
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    },
  };
}

function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// O ETL grava o nome da distribuidora em caixa alta; a igualdade permite usar o índice.
function nomeDistribuidoraLocal(valor: string): string {
  return valor.trim().toUpperCase();
}

interface DistribuidoraLocal {
  nome: string;
  totalAtivos: number;
  latitude: number | null;
  longitude: number | null;
}

export class RegioesRepository {
  async nomeDaDistribuidora(distribuidoraId: number): Promise<string | undefined> {
    const { data, error } = await supabase
      .from("distribuidoras")
      .select("nome")
      .eq("id", distribuidoraId)
      .maybeSingle();

    if (error || !data?.nome) return undefined;
    return String(data.nome);
  }

  private async municipios(params: {
    distribuidora?: string;
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
      values.push(nomeDistribuidoraLocal(params.distribuidora));
      conditions.push(`p.distribuidora = $${values.length}`);
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
	SELECT COUNT(*)::int AS total
	FROM (
		SELECT m.codigo_ibge
		FROM ativos_rede p
		JOIN municipios m
			ON m.codigo_ibge::text = p.municipio
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
	SELECT
		m.nome,
		m.uf,
		COUNT(p.id_ativo)::int AS total_ativos,
		AVG(p.latitude) AS lat,
		AVG(p.longitude) AS lng
	FROM ativos_rede p
	JOIN municipios m
		ON m.codigo_ibge::text = p.municipio
	WHERE ${where}
	GROUP BY m.codigo_ibge, m.nome, m.uf
	ORDER BY m.nome
	LIMIT $${limiteParam}
	OFFSET $${offsetParam}
	`,
      dataValues,
    );

    const dados: MunicipioDTO[] = result.rows.map((row) => ({
      nome: row.nome,
      uf: row.uf,
      totalAtivos: Number(row.total_ativos),
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
    }));

    return {
      dados,
      paginacao: {
        pagina: params.pagina,
        limite: params.limite,
        total,
        totalPaginas: Math.ceil(total / params.limite),
      },
    };
  }

  private async distribuidorasLocais(): Promise<Map<string, DistribuidoraLocal>> {
    try {
      const result = await pool.query<{
        nome: string;
        total_ativos: number;
        latitude: number | null;
        longitude: number | null;
      }>(
        `
	SELECT
		distribuidora AS nome,
		COUNT(*)::int AS total_ativos,
		AVG(latitude) AS latitude,
		AVG(longitude) AS longitude
	FROM ativos_rede
	WHERE registro_atual = TRUE
	  AND distribuidora IS NOT NULL
	  AND distribuidora <> ''
	GROUP BY distribuidora
	`,
      );

      const mapa = new Map<string, DistribuidoraLocal>();
      for (const row of result.rows) {
        mapa.set(normalizarNome(row.nome), {
          nome: row.nome,
          totalAtivos: Number(row.total_ativos),
          latitude: row.latitude == null ? null : Number(row.latitude),
          longitude: row.longitude == null ? null : Number(row.longitude),
        });
      }
      return mapa;
    } catch {
      return new Map();
    }
  }

  async listarDistribuidoras(busca?: string): Promise<DistribuidoraDTO[]> {
    const termo = busca?.trim().toLowerCase();
    const [supabaseResult, locais] = await Promise.all([
      supabase
        .from("distribuidoras")
        .select("id, nome, uf, ano_bdgd")
        .order("nome"),
      this.distribuidorasLocais(),
    ]);

    const usados = new Set<string>();
    const resposta: DistribuidoraDTO[] = [];

    if (!supabaseResult.error) {
      for (const row of supabaseResult.data ?? []) {
        const nomeSupabase = String(row.nome);
        const chave = normalizarNome(nomeSupabase);
        const local = locais.get(chave);
        usados.add(chave);

        resposta.push({
          id: Number(row.id),
          nome: local?.nome ?? nomeSupabase,
          uf: row.uf ?? null,
          anoBdgd: row.ano_bdgd == null ? null : Number(row.ano_bdgd),
          totalAtivos: local?.totalAtivos ?? 0,
          latitude: local?.latitude ?? null,
          longitude: local?.longitude ?? null,
        });
      }
    }

    for (const [chave, local] of locais) {
      if (usados.has(chave)) continue;
      resposta.push({
        id: 0,
        nome: local.nome,
        uf: null,
        anoBdgd: null,
        totalAtivos: local.totalAtivos,
        latitude: local.latitude,
        longitude: local.longitude,
      });
    }

    resposta.sort((a, b) => {
      if (a.totalAtivos !== b.totalAtivos) return b.totalAtivos - a.totalAtivos;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return resposta.filter(
      (distribuidora) =>
        !termo || distribuidora.nome.toLowerCase().includes(termo),
    );
  }

  async listarMunicipios(params: {
    distribuidora?: string;
    busca?: string;
    limite: number;
    pagina: number;
    bbox?: BoundingBox;
  }): Promise<PaginatedResult<MunicipioDTO>> {
    return this.municipios(params);
  }

  async buscarMunicipiosGlobal(params: {
    busca: string;
    limite: number;
    pagina: number;
    bbox?: BoundingBox;
  }): Promise<PaginatedResult<MunicipioDTO>> {
    return this.municipios({ ...params, busca: params.busca });
  }

  async listarEstados(busca?: string): Promise<EstadoDTO[]> {
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
	SELECT
		m.uf,
		COUNT(DISTINCT m.codigo_ibge)::int AS total_municipios,
		COUNT(p.id_ativo)::int AS total_ativos
	FROM ativos_rede p
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

    return result.rows.map((row) => ({
      uf: row.uf,
      totalMunicipios: Number(row.total_municipios),
      totalAtivos: Number(row.total_ativos),
    }));
  }


  async listarBairros(params: {
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
      values.push(nomeDistribuidoraLocal(params.distribuidora));
      conditions.push(`p.distribuidora = $${values.length}`);
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
	SELECT COUNT(*)::int AS total
	FROM (
		SELECT p.bairro, m.codigo_ibge
		FROM ativos_rede p
		JOIN municipios m
			ON m.codigo_ibge::text = p.municipio
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
	SELECT
		p.bairro AS nome,
		m.uf,
		m.nome AS municipio,
		COUNT(p.id_ativo)::int AS total_ativos
	FROM ativos_rede p
	JOIN municipios m
		ON m.codigo_ibge::text = p.municipio
	WHERE ${where}
	GROUP BY p.bairro, m.uf, m.nome
	ORDER BY p.bairro
	LIMIT $${limiteParam}
	OFFSET $${offsetParam}
	`,
      dataValues,
    );

    const dados: BairroDTO[] = result.rows.map((row) => ({
      nome: row.nome,
      uf: row.uf,
      municipio: row.municipio,
      totalAtivos: Number(row.total_ativos),
    }));

    return {
      dados,
      paginacao: {
        pagina: params.pagina,
        limite: params.limite,
        total,
        totalPaginas: Math.ceil(total / params.limite),
      },
    };
  }
}
