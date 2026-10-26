import { BuildingUtils } from "./BuildingUtils.js";
import { GeometryUtils } from "./GeometryUtils.js";
import type { ProvidedBuildings } from "./ProvidedBuildings.js";

export interface BuildingsCalculationResult {
    frequencia_mhz: number;
    total_edificacoes: number;
    edificacoes_ignoradas: number;
    area_ocupada_m2: number;
    altura_m: { minima: number; media: number; maxima: number } | null;
    por_material: {
        codigo_material: string;
        nome_material: string;
        quantidade: number;
        perda_db: number;
    }[];
}

export class BuildingsCalculation {
    private buildingUtils = new BuildingUtils();
    private geometryUtils = new GeometryUtils();

    Calculate(provided: ProvidedBuildings, frequencyMhz: number): BuildingsCalculationResult {
        const buildings = provided.buildings;
        const heights = buildings.map((building) => building.altura_m);

        const byMaterial = new Map<string, { nome: string; quantidade: number }>();
        for (const building of buildings) {
            const entry = byMaterial.get(building.codigo_material);
            if (entry) entry.quantidade += 1;
            else byMaterial.set(building.codigo_material, { nome: building.nome_material, quantidade: 1 });
        }

        return {
            frequencia_mhz: frequencyMhz,
            total_edificacoes: buildings.length,
            edificacoes_ignoradas: provided.ignored,
            area_ocupada_m2: Math.round(buildings.reduce((sum, building) => sum + this.FootprintM2(building.polygons, building.latitude, building.longitude), 0)),
            altura_m: heights.length === 0 ? null : {
                minima: Math.min(...heights),
                media: Math.round((heights.reduce((sum, value) => sum + value, 0) / heights.length) * 10) / 10,
                maxima: Math.max(...heights),
            },
            por_material: [...byMaterial.entries()]
                .map(([codigo, { nome, quantidade }]) => ({
                    codigo_material: codigo,
                    nome_material: nome,
                    quantidade,
                    perda_db: Math.round(this.buildingUtils.MaterialLossDb(codigo, frequencyMhz) * 10) / 10,
                }))
                .sort((a, b) => b.quantidade - a.quantidade),
        };
    }

    private FootprintM2(polygons: [number, number][][][], latitude: number, longitude: number): number {
        const projector = this.geometryUtils.Projector(latitude, longitude);
        let area = 0;
        for (const rings of polygons) {
            rings.forEach((ring, index) => {
                const local = ring.map(([lon, lat]) => projector.toLocal(lon, lat));
                area += (index === 0 ? 1 : -1) * Math.abs(this.geometryUtils.SignedArea(local));
            });
        }
        return Math.max(0, area);
    }
}
