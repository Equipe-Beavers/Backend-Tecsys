import { pool } from "../database/pool.js";
import { supabase } from "../database/supabase.js";
import {
    findScenarioCoverageQuery,
    findScenarioGatewaysCoverageQuery,
    updateGatewayCoverageQuery,
    updateScenarioCoverageQuery,
} from "../database/queries.js";
import type { LinkDTO } from "../interface/BuildingDTO.js";
import type { PerfilRf } from "../interface/perfil-rf.js";
import type {
    BuildingObstacle,
    Coverage,
    GatewayCoverage,
    GenerateCoverageDTO,
    LinkCalculation,
    PropagationParameters,
    PropagationPoint,
    ScenarioCoverage,
} from "../interface/PropagationDTO.js";
import { PropagationUtils } from "../utils/PropagationUtils.js";
import { BuildingService } from "./BuildingService.js";

const DEFAULT_RAYS = 360;
const MIN_STEP_M = 10;
const MAX_STEP_M = 100;
const STEPS_PER_RAY = 150;

export class PropagationService {
    private propagationUtils: PropagationUtils;
    private buildingService: BuildingService;

    constructor() {
        this.propagationUtils = new PropagationUtils();
        this.buildingService = new BuildingService();
    }

    buildParameters(profile: PerfilRf, gatewayHeightM?: number): PropagationParameters {
        return this.propagationUtils.BuildParameters(profile, gatewayHeightM);
    }

    /**
     * As edificações só entram no cálculo quando o perfil pede e quando a região tem
     * edificações carregadas pelo ETL. Sem dados, o cálculo usa o Hata do ambiente do perfil.
     */
    async useBuildings(params: PropagationParameters, latitude: number, longitude: number): Promise<boolean> {
        if (!params.considerBuildings) return false;
        return this.buildingService.hasBuildingsNear(latitude, longitude);
    }

    /** Importa da Overture as edificações da área do estudo, se ainda não estiverem no banco. */
    async prepareStudyBuildings(idStudy: number, params: PropagationParameters): Promise<void> {
        if (params.considerBuildings) await this.buildingService.ensureStudyBuildings(idStudy);
    }

    modelName(explicitBuildings: boolean, params: PropagationParameters): string {
        const hata = params.frequencyMhz <= 1500 ? "Okumura-Hata" : "COST-231 Hata";
        return explicitBuildings
            ? `${hata} (área aberta) + edificações (ITU-R P.526 / penetração)`
            : `${hata} (${params.environment})`;
    }

    /** Sinal do gateway em cada ponto, considerando as edificações entre eles. */
    async calculateLinks(
        gateway: { latitude: number; longitude: number },
        points: PropagationPoint[],
        params: PropagationParameters,
        explicitBuildings: boolean,
    ): Promise<Map<string, LinkCalculation>> {
        const maxRangeM = this.propagationUtils.MaxRangeM(params, explicitBuildings);
        const result = new Map<string, LinkCalculation>();

        const inRange = points
            .map((point) => ({
                point,
                distanceM: this.propagationUtils.MetersDistance(
                    gateway.latitude,
                    gateway.longitude,
                    point.latitude,
                    point.longitude,
                ),
            }))
            .filter(({ distanceM }) => distanceM <= maxRangeM);

        let obstaclesByLink = new Map<string, BuildingObstacle[]>();
        if (explicitBuildings && inRange.length > 0) {
            const links: LinkDTO[] = inRange.map(({ point }) => ({
                id: point.id,
                origin: { latitude: gateway.latitude, longitude: gateway.longitude, height_m: params.gatewayHeightM },
                destination: { latitude: point.latitude, longitude: point.longitude, height_m: params.deviceHeightM },
            }));
            const rows = await this.buildingService.findBuildingsOnLinks(links, params.frequencyMhz);
            obstaclesByLink = this.buildingService.groupObstaclesByLink(rows);
        }

        for (const { point, distanceM } of inRange) {
            const pathLossDb = this.propagationUtils.PathLossDb(distanceM, params, explicitBuildings);
            const buildingsLossDb = explicitBuildings
                ? this.propagationUtils.BuildingsLossDb(obstaclesByLink.get(point.id) ?? [], distanceM, params)
                : 0;
            const signalDbm = this.propagationUtils.SignalLevelDbm(params, pathLossDb + buildingsLossDb);

            result.set(point.id, {
                distanceM,
                pathLossDb: this.propagationUtils.Round1(pathLossDb),
                buildingsLossDb: this.propagationUtils.Round1(buildingsLossDb),
                signalDbm: this.propagationUtils.Round1(signalDbm),
                covered: this.propagationUtils.IsCovered(params, signalDbm),
            });
        }

        return result;
    }

    /**
     * Mancha de cobertura pelo método radial: a partir do gateway são traçados `rays` raios;
     * em cada um o sinal é calculado em passos até o primeiro ponto sem cobertura.
     * Os pontos-limite de todos os raios formam o polígono.
     */
    async buildCoverage(
        latitude: number,
        longitude: number,
        params: PropagationParameters,
        rays = DEFAULT_RAYS,
        explicitBuildingsInput?: boolean,
    ): Promise<Coverage> {
        const explicitBuildings = explicitBuildingsInput ?? (await this.useBuildings(params, latitude, longitude));
        const maxRangeM = this.propagationUtils.MaxRangeM(params, explicitBuildings);
        const stepM = Math.min(MAX_STEP_M, Math.max(MIN_STEP_M, maxRangeM / STEPS_PER_RAY));
        const bearings = Array.from({ length: rays }, (_, i) => (360 * i) / rays);

        let obstaclesByRay = new Map<string, BuildingObstacle[]>();
        if (explicitBuildings && maxRangeM > 0) {
            const links: LinkDTO[] = bearings.map((bearing) => {
                const end = this.propagationUtils.Destination(latitude, longitude, bearing, maxRangeM);
                return {
                    id: String(bearing),
                    origin: { latitude, longitude, height_m: params.gatewayHeightM },
                    destination: { latitude: end.latitude, longitude: end.longitude, height_m: params.deviceHeightM },
                };
            });
            const rows = await this.buildingService.findBuildingsOnLinks(links, params.frequencyMhz);
            obstaclesByRay = this.buildingService.groupObstaclesByLink(rows);
        }

        const reaches = bearings.map((bearing) => {
            const obstacles = obstaclesByRay.get(String(bearing)) ?? [];
            let reachM = 0;

            for (let distanceM = stepM; distanceM <= maxRangeM + 1e-6; distanceM += stepM) {
                const buildingsLossDb = explicitBuildings
                    ? this.propagationUtils.BuildingsLossDb(obstacles, distanceM, params)
                    : 0;
                const totalLossDb = this.propagationUtils.PathLossDb(distanceM, params, explicitBuildings) + buildingsLossDb;
                const signalDbm = this.propagationUtils.SignalLevelDbm(params, totalLossDb);
                if (!this.propagationUtils.IsCovered(params, signalDbm)) break;
                reachM = distanceM;
            }

            return { bearing, reachM };
        });

        // Anel no sentido anti-horário, fechado no primeiro ponto (GeoJSON).
        const ring = [...reaches].reverse().map(({ bearing, reachM }) => {
            const point = this.propagationUtils.Destination(latitude, longitude, bearing, Math.max(reachM, 1));
            return [Number(point.longitude.toFixed(7)), Number(point.latitude.toFixed(7))];
        });
        ring.push([...ring[0]!]);

        const values = reaches.map((reach) => reach.reachM);
        return {
            geometry: { type: "Polygon", coordinates: [ring] },
            min_range_m: Math.round(Math.min(...values)),
            mean_range_m: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
            max_range_m: Math.round(Math.max(...values)),
            model: this.modelName(explicitBuildings, params),
            environment: explicitBuildings ? "rural" : params.environment,
            buildings_considered: explicitBuildings,
            rays,
        };
    }

    /** Mancha de um gateway avulso, a partir de um perfil RF cadastrado. */
    async generateCoverage(input: GenerateCoverageDTO): Promise<Coverage> {
        const { data: profile, error } = await supabase
            .from("perfis_rf")
            .select("*")
            .eq("id_perfil_rf", input.id_perfil_rf)
            .maybeSingle();
        if (error) throw new Error(`Erro ao consultar perfil de RF: ${error.message}.`);
        if (!profile) throw new Error("Perfil de RF não encontrado.");

        const params = this.buildParameters(profile as PerfilRf, input.gateway_height_m);
        if (params.considerBuildings) {
            await this.buildingService.ensureBuildingsAround(input.latitude, input.longitude);
        }
        return this.buildCoverage(input.latitude, input.longitude, params, input.rays ?? DEFAULT_RAYS);
    }

    async saveGatewayCoverage(idScenarioGateway: number, coverage: Coverage, params: PropagationParameters) {
        await pool.query(updateGatewayCoverageQuery, [
            idScenarioGateway,
            JSON.stringify(coverage.geometry),
            JSON.stringify({
                modelo: coverage.model,
                ambiente: coverage.environment,
                edificacoes_consideradas: coverage.buildings_considered,
                alcance_medio_m: coverage.mean_range_m,
                altura_gateway_m: params.gatewayHeightM,
                altura_dispositivo_m: params.deviceHeightM,
                margem_db: params.marginDb,
                raios: coverage.rays,
            }),
        ]);
    }

    /** Une as manchas dos gateways do cenário em `cenarios.mancha_consolidada`. */
    async saveScenarioCoverage(idScenario: number): Promise<Record<string, unknown> | null> {
        const result = await pool.query(updateScenarioCoverageQuery, [idScenario]);
        return result.rows[0]?.mancha_consolidada ?? null;
    }

    /** Manchas salvas de um cenário, para exibir no mapa ou reabrir o estudo. */
    async getScenarioCoverage(idScenario: number): Promise<ScenarioCoverage> {
        const scenario = await pool.query(findScenarioCoverageQuery, [idScenario]);
        if (scenario.rows.length === 0) throw new Error("Cenário não encontrado.");

        const gateways = await pool.query(findScenarioGatewaysCoverageQuery, [idScenario]);

        return {
            id_cenario: idScenario,
            mancha_consolidada: scenario.rows[0]?.mancha_consolidada ?? null,
            gateways: gateways.rows.map((row) => ({
                ...row,
                id_cenario_gateway: Number(row.id_cenario_gateway),
                id_estudo_ponto: Number(row.id_estudo_ponto),
            }) as GatewayCoverage),
        };
    }
}
