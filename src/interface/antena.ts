/** Contratos de entrada e saída da camada de antenas da Anatel. */
export interface AntenasQuery {
    minLatitude?: string;
    maxLatitude?: string;
    minLongitude?: string;
    maxLongitude?: string;
    limit?: string;
}

export interface AntenasBoundingBox {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
}

export interface AntenaSiteDTO {
    id: string;
    nomeEntidade: string | null;
    municipio: string | null;
    uf: string | null;
    latitude: number;
    longitude: number;
    totalRegistros: number;
    tecnologias: string[];
    tipoEstacao: string | null;
    alturaAntenaMediaM: number | null;
}

export interface AntenasListResponse {
    data: AntenaSiteDTO[];
    total: number;
}
