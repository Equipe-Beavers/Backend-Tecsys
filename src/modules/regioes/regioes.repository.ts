import { supabase } from "../../database/supabase.js";

export interface DistribuidoraDTO {
	id: number;
	nome: string;
	uf: string | null;
	anoBdgd: number | null;
	totalAtivos: number;
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

function paginated<T>(rows: Array<T & { total: string | number }>, pagina: number, limite: number): PaginatedResult<T> {
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
		let query = supabase
			.from("posicoes_geograficas")
			.select("municipio, latitude, longitude", { count: "exact" })
			.eq("registro_atual", true)
			.not("municipio", "is", null);
		if (params.busca?.trim()) query = query.ilike("municipio", `%${params.busca.trim()}%`);
		if (params.bbox) {
			query = query.gte("latitude", params.bbox.minLat).lte("latitude", params.bbox.maxLat)
				.gte("longitude", params.bbox.minLng).lte("longitude", params.bbox.maxLng);
		}
		const { data, error } = await query.limit(10000);
		if (error) throw error;

		const grouped = new Map<string, MunicipioDTO>();
		for (const row of data ?? []) {
			const nome = String(row.municipio);
			const atual = grouped.get(nome);
			if (atual) {
				atual.totalAtivos += 1;
				continue;
			}
			grouped.set(nome, {
				nome,
				uf: null,
				totalAtivos: 1,
				lat: row.latitude == null ? null : Number(row.latitude),
				lng: row.longitude == null ? null : Number(row.longitude),
			});
		}
		const todos = [...grouped.values()].sort((a, b) => a.nome.localeCompare(b.nome));
		const inicio = (params.pagina - 1) * params.limite;
		const dados = todos.slice(inicio, inicio + params.limite);
		return { dados, paginacao: { pagina: params.pagina, limite: params.limite, total: todos.length, totalPaginas: Math.ceil(todos.length / params.limite) } };
	}

	async listarDistribuidoras(busca?: string): Promise<DistribuidoraDTO[]> {
		const termo = busca?.trim().toLowerCase();
		const { data, error } = await supabase.from("distribuidoras").select("id, nome, uf, ano_bdgd, total_ativos").order("nome");
		if (error) return [];
		return (data ?? [])
			.filter((row) => !termo || String(row.nome).toLowerCase().includes(termo))
			.map((row) => ({
				id: Number(row.id), nome: String(row.nome), uf: row.uf ?? null,
				anoBdgd: row.ano_bdgd == null ? null : Number(row.ano_bdgd),
				totalAtivos: Number(row.total_ativos ?? 0),
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

	async listarBairros(params: {
		distribuidoraId?: number;
		municipio?: string;
		busca?: string;
		limite: number;
		pagina: number;
	}): Promise<PaginatedResult<BairroDTO>> {
		let query = supabase.from("posicoes_geograficas").select("bairro, municipio").eq("registro_atual", true).not("bairro", "is", null);
		if (params.municipio?.trim()) query = query.ilike("municipio", params.municipio.trim());
		if (params.busca?.trim()) query = query.ilike("bairro", `%${params.busca.trim()}%`);
		const { data, error } = await query.limit(10000);
		if (error) throw error;
		const agrupados = new Map<string, BairroDTO>();
		for (const row of data ?? []) {
			const nome = String(row.bairro);
			const chave = `${row.municipio ?? ""}|${nome}`;
			const atual = agrupados.get(chave);
			if (atual) atual.totalAtivos += 1;
			else agrupados.set(chave, { nome, uf: null, municipio: row.municipio ?? null, totalAtivos: 1 });
		}
		const todos = [...agrupados.values()].sort((a, b) => a.nome.localeCompare(b.nome));
		const inicio = (params.pagina - 1) * params.limite;
		return { dados: todos.slice(inicio, inicio + params.limite), paginacao: { pagina: params.pagina, limite: params.limite, total: todos.length, totalPaginas: Math.ceil(todos.length / params.limite) } };
	}
}
