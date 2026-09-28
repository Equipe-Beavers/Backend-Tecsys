import { supabase } from "../../database/supabase.js";
import { pool } from "../../database/pool.js";

export interface DistribuidoraDTO {
  id: number;
  nome: string;
  uf: string | null;
  anoBdgd: number | null;
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

export class RegioesRepository {
  private async municipios(params: {
    distribuidoraId?: number;
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
		FROM posicoes_geograficas p
		JOIN municipios m
			ON m.codigo_ibge = p.municipio::integer
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
		COUNT(p.id_posicao)::int AS total_ativos,
		AVG(p.latitude) AS lat,
		AVG(p.longitude) AS lng
	FROM posicoes_geograficas p
	JOIN municipios m
		ON m.codigo_ibge = p.municipio::integer
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

  async listarDistribuidoras(busca?: string): Promise<DistribuidoraDTO[]> {
    const termo = busca?.trim().toLowerCase();
    const { data, error } = await supabase
      .from("distribuidoras")
      .select("id, nome, uf, ano_bdgd")
      .order("nome");
    if (error) return [];
    return (data ?? [])
      .filter((row) => !termo || String(row.nome).toLowerCase().includes(termo))
      .map((row) => ({
        id: Number(row.id),
        nome: String(row.nome),
        uf: row.uf ?? null,
        anoBdgd: row.ano_bdgd == null ? null : Number(row.ano_bdgd),
      }));
  }

  async listarMunicipios(params: {
    distribuidoraId: number;
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
    return [];
  }


//   NÃO ESTÁ SENDO UTILIZADO NO MOMENTO

  async listarBairros(params: {
    distribuidoraId?: number;
    municipio?: string;
    busca?: string;
    limite: number;
    pagina: number;
  }): Promise<PaginatedResult<BairroDTO>> {
    let query = supabase
      .from("posicoes_geograficas")
      .select("bairro, municipio")
      .eq("registro_atual", true)
      .not("bairro", "is", null);
    if (params.municipio?.trim())
      query = query.ilike("municipio", params.municipio.trim());
    if (params.busca?.trim())
      query = query.ilike("bairro", `%${params.busca.trim()}%`);
    const { data, error } = await query.limit(10000);
    if (error) throw error;
    const agrupados = new Map<string, BairroDTO>();
    for (const row of data ?? []) {
      const nome = String(row.bairro);
      const chave = `${row.municipio ?? ""}|${nome}`;
      const atual = agrupados.get(chave);
      if (atual) atual.totalAtivos += 1;
      else
        agrupados.set(chave, {
          nome,
          uf: null,
          municipio: row.municipio ?? null,
          totalAtivos: 1,
        });
    }
    const todos = [...agrupados.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );
    const inicio = (params.pagina - 1) * params.limite;
    return {
      dados: todos.slice(inicio, inicio + params.limite),
      paginacao: {
        pagina: params.pagina,
        limite: params.limite,
        total: todos.length,
        totalPaginas: Math.ceil(todos.length / params.limite),
      },
    };
  }
}
