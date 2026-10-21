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

export interface DistribuidoraLocal {
  nome: string;
  totalAtivos: number;
  latitude: number | null;
  longitude: number | null;
}