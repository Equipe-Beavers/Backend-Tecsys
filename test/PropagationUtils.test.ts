import { describe, expect, it } from "vitest";

import type { PropagationParameters } from "../src/interface/PropagationDTO.js";
import { PropagationUtils } from "../src/utils/PropagationUtils.js";

const utils = new PropagationUtils();

const params: PropagationParameters = {
    frequencyMhz: 915,
    txPowerDbm: 20,
    rxSensitivityDbm: -130,
    gatewayGainDbi: 5,
    deviceGainDbi: 0,
    cableLossDb: 2,
    marginDb: 10,
    gatewayHeightM: 15,
    deviceHeightM: 2,
    environment: "urban",
    considerBuildings: true,
    estimatedRangeM: null,
};

describe("PropagationUtils", () => {
    it("calcula a perda máxima do balanço de potência", () => {
        expect(utils.MaxPathLossDb(params)).toBe(143);
    });

    it("calcula o Okumura-Hata urbano (129,5 + 37,2·log d)", () => {
        expect(utils.HataLossDb(1000, 915, 15, 2, "urban")).toBeCloseTo(129.5, 0);
        expect(utils.HataLossDb(10000, 915, 15, 2, "urban")).toBeCloseTo(166.7, 0);
    });

    it("alcance urbano sem edificações fica perto de 2,3 km", () => {
        const range = utils.MaxRangeM({ ...params, considerBuildings: false }, false);
        expect(range).toBeGreaterThan(2200);
        expect(range).toBeLessThan(2400);
    });

    it("respeita o alcance estimado do perfil como limite", () => {
        expect(utils.MaxRangeM({ ...params, estimatedRangeM: 500 }, false)).toBe(500);
    });

    it("nunca devolve perda menor que o espaço livre", () => {
        expect(utils.PathLossDb(30, params, true)).toBeGreaterThanOrEqual(utils.FreeSpaceLossDb(30, 915));
    });

    it("difração em gume de faca vale ~6 dB com a linha rente ao obstáculo", () => {
        expect(utils.KnifeEdgeLossDb(0)).toBeCloseTo(6.0, 1);
        expect(utils.KnifeEdgeLossDb(-1)).toBe(0);
    });

    it("sem edificações no caminho não há perda extra", () => {
        expect(utils.BuildingsLossDb([], 500, params)).toBe(0);
    });

    it("prédio alto de concreto bloqueia e a perda é a menor entre difração e penetração", () => {
        const concrete = [{ entryDistanceM: 300, insideLengthM: 20, heightM: 40, materialLossDb: 12 }];
        const loss = utils.BuildingsLossDb(concrete, 500, params);
        const penetration = 2 * 12 + 0.6 * 20;
        expect(loss).toBeGreaterThan(10);
        expect(loss).toBeLessThanOrEqual(penetration);
    });

    it("prédio de vidro deixa o sinal passar com perda menor que o de concreto", () => {
        const glass = [{ entryDistanceM: 300, insideLengthM: 20, heightM: 40, materialLossDb: 2 }];
        const concrete = [{ entryDistanceM: 300, insideLengthM: 20, heightM: 40, materialLossDb: 12 }];
        expect(utils.BuildingsLossDb(glass, 500, params)).toBeLessThan(utils.BuildingsLossDb(concrete, 500, params));
    });

    it("edificação depois do ponto não interfere", () => {
        const after = [{ entryDistanceM: 600, insideLengthM: 20, heightM: 40, materialLossDb: 12 }];
        expect(utils.BuildingsLossDb(after, 500, params)).toBe(0);
    });

    it("calcula o ponto de destino a partir de direção e distância", () => {
        const point = utils.Destination(-23.2, -45.9, 0, 1000);
        expect(utils.MetersDistance(-23.2, -45.9, point.latitude, point.longitude)).toBeCloseTo(1000, 0);
        expect(point.longitude).toBeCloseTo(-45.9, 6);
    });
});
