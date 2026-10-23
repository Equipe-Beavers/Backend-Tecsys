export interface EmissoesRfQuery {
    minLatitude?: string;
    maxLatitude?: string;
    minLongitude?: string;
    maxLongitude?: string;
    limit?: string;
}

export interface EmissoesRfBoundingBox {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
}

export interface EmissaoRfDTO {
    id: string;
    uid: string | null;
    sourceKey: string;
    fonteDados: string;
    status: string | null;
    entidade: string | null;
    numServico: string | null;
    numEstacao: string | null;
    municipio: string | null;
    uf: string | null;
    emissao: string | null;
    tecnologia: string | null;
    tipoTecnologia: string | null;
    meioAcesso: string | null;
    frequenciaTxMHz: number | null;
    frequenciaRxMHz: number | null;
    potenciaTransmissorW: number | null;
    ganhoAntena: number | null;
    azimuteGraus: number | null;
    anguloMeiaPotenciaGraus: number | null;
    frenteCostas: number | null;
    elevacaoGraus: number | null;
    polarizacao: string | null;
    alturaAntenaM: number | null;
    tipoAntena: string | null;
    latitude: number;
    longitude: number;
    dataLicenciamento: string | null;
    dataValidade: string | null;
}

export interface EmissoesRfListResponse {
    data: EmissaoRfDTO[];
    total: number;
    limit: number;
}
