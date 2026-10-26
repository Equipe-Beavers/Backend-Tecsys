import type {
    BuildingObstacle,
    PropagationEnvironment,
    PropagationParameters,
} from "../interface/PropagationDTO.js";
import type { PerfilRf } from "../interface/perfil-rf.js";

const EARTH_RADIUS_M = 6371000;
const INTERIOR_LOSS_DB_PER_M = 0.6;
const MAX_RANGE_M = 30000;
const MIN_DISTANCE_KM = 0.02;

const ENVIRONMENTS: Record<string, PropagationEnvironment> = {
    urbano: "urban",
    urban: "urban",
    suburbano: "suburban",
    suburban: "suburban",
    rural: "rural",
};

interface Edge {
    x: number;
    height: number;
}


export class PropagationUtils {
    NumberOr(value: unknown, fallback: number): number {
        const parsed = typeof value === "string" ? Number(value) : value;
        return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
    }

    BuildParameters(profile: PerfilRf, gatewayHeightM?: number): PropagationParameters {
        const antenna = (profile.caracteristicas_antena ?? {}) as Record<string, unknown>;
        const extra = (profile.parametros_adicionais ?? {}) as Record<string, unknown>;
        const environment = ENVIRONMENTS[String(extra.ambiente ?? "urbano").toLowerCase()] ?? "urban";

        return {
            frequencyMhz: Number(profile.frequencia_mhz),
            txPowerDbm: Number(profile.potencia_transmissao_dbm),
            rxSensitivityDbm: Number(profile.sensibilidade_recepcao_dbm),
            gatewayGainDbi: this.NumberOr(antenna.ganho_gateway_dbi ?? antenna.ganho_dbi, 0),
            deviceGainDbi: this.NumberOr(antenna.ganho_dispositivo_dbi, 0),
            cableLossDb: this.NumberOr(antenna.perda_cabos_db, 0),
            marginDb: this.NumberOr(extra.margem_db, 10),
            gatewayHeightM: gatewayHeightM ?? this.NumberOr(profile.altura_gateway_m, 15),
            deviceHeightM: this.NumberOr(profile.altura_dispositivo_m, 2),
            environment,
            considerBuildings: true,
            estimatedRangeM: profile.alcance_estimado_m != null ? Number(profile.alcance_estimado_m) : null,
        };
    }

    MaxPathLossDb(params: PropagationParameters): number {
        return (
            params.txPowerDbm +
            params.gatewayGainDbi +
            params.deviceGainDbi -
            params.cableLossDb -
            params.marginDb -
            params.rxSensitivityDbm
        );
    }

    SignalLevelDbm(params: PropagationParameters, totalLossDb: number): number {
        return params.txPowerDbm + params.gatewayGainDbi + params.deviceGainDbi - params.cableLossDb - totalLossDb;
    }

    IsCovered(params: PropagationParameters, signalDbm: number): boolean {
        return signalDbm >= params.rxSensitivityDbm + params.marginDb;
    }

    FreeSpaceLossDb(distanceM: number, frequencyMhz: number): number {
        const km = Math.max(distanceM / 1000, 0.001);
        return 20 * Math.log10(km) + 20 * Math.log10(frequencyMhz) + 32.44;
    }

    HataLossDb(
        distanceM: number,
        frequencyMhz: number,
        gatewayHeightM: number,
        deviceHeightM: number,
        environment: PropagationEnvironment,
    ): number {
        const km = Math.max(distanceM / 1000, MIN_DISTANCE_KM);
        const logF = Math.log10(frequencyMhz);
        const logHb = Math.log10(Math.max(gatewayHeightM, 1));
        const aHm = (1.1 * logF - 0.7) * deviceHeightM - (1.56 * logF - 0.8);
        const slope = (44.9 - 6.55 * logHb) * Math.log10(km);

        const urban = frequencyMhz <= 1500
            ? 69.55 + 26.16 * logF - 13.82 * logHb - aHm + slope
            : 46.3 + 33.9 * logF - 13.82 * logHb - aHm + slope;

        if (environment === "suburban") return urban - 2 * Math.log10(frequencyMhz / 28) ** 2 - 5.4;
        if (environment === "rural") return urban - 4.78 * logF ** 2 + 18.33 * logF - 40.94;
        return urban;
    }

    PathLossDb(distanceM: number, params: PropagationParameters, explicitBuildings: boolean): number {
        const environment = explicitBuildings ? "rural" : params.environment;
        const hata = this.HataLossDb(
            distanceM,
            params.frequencyMhz,
            params.gatewayHeightM,
            params.deviceHeightM,
            environment,
        );
        return Math.max(hata, this.FreeSpaceLossDb(distanceM, params.frequencyMhz));
    }

    MaxRangeM(params: PropagationParameters, explicitBuildings: boolean): number {
        const budget = this.MaxPathLossDb(params);
        let low = 0;
        let high = MAX_RANGE_M;

        if (this.PathLossDb(high, params, explicitBuildings) <= budget) {
            low = high;
        } else {
            for (let i = 0; i < 40; i++) {
                const mid = (low + high) / 2;
                if (this.PathLossDb(mid, params, explicitBuildings) <= budget) low = mid;
                else high = mid;
            }
        }

        const range = params.estimatedRangeM != null ? Math.min(low, params.estimatedRangeM) : low;
        return Math.max(0, range);
    }

    KnifeEdgeLossDb(v: number): number {
        if (v <= -0.78) return 0;
        return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
    }

    DiffractionLossDb(edges: Edge[], start: Edge, end: Edge, wavelengthM: number, depth = 0): number {
        let best: { v: number; edge: Edge } | null = null;

        for (const edge of edges) {
            if (edge.x <= start.x || edge.x >= end.x) continue;
            const d1 = edge.x - start.x;
            const d2 = end.x - edge.x;
            const lineHeight = start.height + ((end.height - start.height) * d1) / (d1 + d2);
            const clearance = edge.height - lineHeight;
            const v = clearance * Math.sqrt((2 * (d1 + d2)) / (wavelengthM * d1 * d2));
            if (!best || v > best.v) best = { v, edge };
        }

        if (!best || best.v <= -0.78) return 0;

        const main = this.KnifeEdgeLossDb(best.v);
        if (depth >= 1) return main;

        return (
            main +
            this.DiffractionLossDb(edges, start, best.edge, wavelengthM, depth + 1) +
            this.DiffractionLossDb(edges, best.edge, end, wavelengthM, depth + 1)
        );
    }

    BuildingsLossDb(obstacles: BuildingObstacle[], distanceM: number, params: PropagationParameters): number {
        const wavelengthM = 299.792458 / params.frequencyMhz;
        const start = { x: 0, height: params.gatewayHeightM };
        const end = { x: distanceM, height: params.deviceHeightM };

        const edges: Edge[] = [];
        let penetrationDb = 0;
        let blocked = false;

        for (const obstacle of obstacles) {
            if (obstacle.entryDistanceM >= distanceM) continue;

            const inside = Math.min(obstacle.insideLengthM, distanceM - obstacle.entryDistanceM);
            const endsInside = obstacle.entryDistanceM + obstacle.insideLengthM >= distanceM - 0.5;
            const x = obstacle.entryDistanceM + inside / 2;
            edges.push({ x, height: obstacle.heightM });

            const lineHeight = start.height + ((end.height - start.height) * x) / distanceM;
            if (obstacle.heightM > lineHeight) {
                blocked = true;
                const walls = endsInside ? 1 : 2;
                penetrationDb += walls * obstacle.materialLossDb + INTERIOR_LOSS_DB_PER_M * inside;
            }
        }

        const diffractionDb = this.DiffractionLossDb(edges, start, end, wavelengthM);
        return blocked ? Math.min(diffractionDb, penetrationDb) : diffractionDb;
    }

    Destination(latitude: number, longitude: number, bearingDeg: number, distanceM: number) {
        const rad = Math.PI / 180;
        const angular = distanceM / EARTH_RADIUS_M;
        const bearing = bearingDeg * rad;
        const lat1 = latitude * rad;
        const lon1 = longitude * rad;

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
        );
        const lon2 =
            lon1 +
            Math.atan2(
                Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
                Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
            );

        return { latitude: lat2 / rad, longitude: lon2 / rad };
    }

    MetersDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const rad = (d: number) => (d * Math.PI) / 180;
        const dLat = rad(lat2 - lat1);
        const dLon = rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
    }

    Round1(value: number): number {
        return Math.round(value * 10) / 10;
    }
}
