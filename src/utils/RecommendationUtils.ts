import type { EstudoPonto } from "../interface/estudo-ponto.js";
import type { PerfilRf } from "../interface/perfil-rf.js";

export interface AtendimentoCalculado {
  ponto: EstudoPonto;
  distanciaM: number;
  nivelSinalDbm: number;
}

export interface GatewayCalculado {
  candidato: EstudoPonto;
  atendimentos: AtendimentoCalculado[];
}

export interface ResultadoCalculo {
  gateways: GatewayCalculado[];
  pontosNaoCobertos: EstudoPonto[];
}

export interface AtendimentoCalculado {
  ponto: EstudoPonto;
  distanciaM: number;
  nivelSinalDbm: number;
}

export interface GatewayCalculado {
  candidato: EstudoPonto;
  atendimentos: AtendimentoCalculado[];
}

export interface ResultadoCalculo {
  gateways: GatewayCalculado[];
  pontosNaoCobertos: EstudoPonto[];
}

const WEIGHT_PRIORIRY: Record<string, number> = {critico: 3, alta: 2, normal: 1};


export class RecommendationUtils {
  MetersDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  DBMPathLoss(KmDistance: number, MhzFreq: number): number {
    if (KmDistance <= 0) return 0;
    return 20 * Math.log10(KmDistance) + 20 * Math.log10(MhzFreq) + 32.44;
  }

  DBMSinalLevel(MDistance: number, MhzFreq: number, DBMPot: number) {
    const KmDistance = MDistance / 1000;
    return DBMPot - this.DBMPathLoss(KmDistance, MhzFreq);
  }

  MMaxRange(profile: {
    alcance_estimado_m: number | null;
    frequencia_mhz: number;
    potencia_transmissao_dbm: number;
    sensibilidade_recepcao_dbm: number;
  }): number {
    if (profile.alcance_estimado_m != null) return profile.alcance_estimado_m;
    const DBMargem =
      profile.potencia_transmissao_dbm - profile.sensibilidade_recepcao_dbm;
    const KMDistance = Math.pow(
      10,
      (DBMargem - 20 * Math.log10(profile.frequencia_mhz) - 32.44) / 20,
    );
    return Math.max(0, KMDistance * 1000);
  }

  /**
   * Escolhe os gateways de forma gulosa: a cada rodada fica o candidato que cobre mais pontos
   * ainda descobertos (com peso pela prioridade), respeitando a capacidade do gateway.
   * `coverage` traz, para cada candidato, os pontos que ele cobre segundo o cálculo de
   * propagação (PropagationService), já com distância e nível de sinal.
   */
  CalculateRecommendation(
    candidates: EstudoPonto[],
    interestPoint: EstudoPonto[],
    RFProfile: PerfilRf,
    coverage: Map<number, AtendimentoCalculado[]>,
  ): ResultadoCalculo {
    const capability = RFProfile.capacidade_max_equipamentos ?? Infinity;
    const pending = new Map(interestPoint.map((p) => [p.id_estudo_ponto, p]));

    const gateways: GatewayCalculado[] = [];
    let rest = [...candidates];

    while (pending.size > 0 && rest.length > 0) {
        let best: {candidate: EstudoPonto;  covered: AtendimentoCalculado[]; score: number} | null = null;
        for (const c of rest) {
            const possibilities = (coverage.get(c.id_estudo_ponto) ?? []).filter(
                (a) => pending.has(a.ponto.id_estudo_ponto)
            );
            const ordinated = possibilities.sort(
                (a, b) => (WEIGHT_PRIORIRY[b.ponto.prioridade ?? "normal"] ?? 1) - (WEIGHT_PRIORIRY[a.ponto.prioridade ?? "normal"] ?? 1)
            );
            const covered = capability === Infinity ? ordinated : ordinated.slice(0, capability);
            const score = covered.reduce((s, a) => s + (WEIGHT_PRIORIRY[a.ponto.prioridade ?? "normal"] ?? 1), 0);
            if (!best || score > best.score) best = {candidate: c, covered, score};
        }

        if (!best || best.covered.length === 0) break;

        const choosedCandidate = best.candidate;
        best.covered.forEach((a) => pending.delete(a.ponto.id_estudo_ponto));
        gateways.push({
            candidato: choosedCandidate,
            atendimentos: best.covered,
        });
        rest =  rest.filter((c) => c.id_estudo_ponto !== choosedCandidate.id_estudo_ponto);
    }
    return {gateways, pontosNaoCobertos: [...pending.values()]};
  }
}
