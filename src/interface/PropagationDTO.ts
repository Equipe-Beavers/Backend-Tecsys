export type PropagationEnvironment =
    | "urban"
    | "suburban"
    | "rural";

export interface PropagationParameters {
    frequencyMhz: number;
    txPowerDbm: number;
    rxSensitivityDbm: number;
    gatewayGainDbi: number;
    deviceGainDbi: number;
    cableLossDb: number;
    marginDb: number;
    gatewayHeightM: number;
    deviceHeightM: number;
    environment: PropagationEnvironment;
    considerBuildings: boolean;
    estimatedRangeM: number | null;
}

export interface BuildingObstacle {
    entryDistanceM: number;
    insideLengthM: number;
    heightM: number;
    materialLossDb: number;
}

export interface PropagationPoint {
    id: string;
    latitude: number;
    longitude: number;
}

export interface LinkCalculation {
    distanceM: number;
    pathLossDb: number;
    buildingsLossDb: number;
    signalDbm: number;
    covered: boolean;
}

export interface Coverage {
    geometry: {
        type: "Polygon";
        coordinates: number[][][];
    };
    min_range_m: number;
    mean_range_m: number;
    max_range_m: number;
    model: string;
    environment: PropagationEnvironment;
    buildings_considered: boolean;
    buildings_count: number;
    buildings_radius_m: number | null;
    buildings_error: string | null;
    rays: number;
}

export interface GenerateCoverageDTO {
    latitude: number;
    longitude: number;
    id_perfil_rf: number;
    gateway_height_m?: number;
    rays?: number;
}
export interface GatewayCoverage {
    id_cenario_gateway: number;
    id_estudo_ponto: number;
    rotulo: string | null;
    latitude: number;
    longitude: number;
    alcance_medio_m: number | null;
    modelo_propagacao: string | null;
    mancha_cobertura: Record<string, unknown> | null;
}

export interface ScenarioCoverage {
    id_cenario: number;
    mancha_consolidada: Record<string, unknown> | null;
    gateways: GatewayCoverage[];
}
