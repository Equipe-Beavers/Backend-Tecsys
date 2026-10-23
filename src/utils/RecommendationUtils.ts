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

  CalculateRecommendation(candidates: EstudoPonto[], interestPoint: EstudoPonto[], RFProfile: PerfilRf,): ResultadoCalculo {
    const range = this.MMaxRange(RFProfile);
    const capability = RFProfile.capacidade_max_equipamentos ??  Infinity;

    const pending = new Map(interestPoint.map((p) => [p.id_estudo_ponto, p]));
    const rangePerCandidate = new Map<number, EstudoPonto[]>();
    for (const c of candidates) {
        const inside = interestPoint.filter((p) => this.MetersDistance(c.latitude, c.longitude, p.latitude, p.longitude) <= range); 
        rangePerCandidate.set(c.id_estudo_ponto, inside);
    }

    const gateways: GatewayCalculado[] = [];
    let rest = [...candidates];

    while (pending.size > 0 && rest.length > 0) {
        let best: {candidate: EstudoPonto;  covered: EstudoPonto[]; score: number} | null = null;
        for (const c of rest) {
            const possibilities = (rangePerCandidate.get(c.id_estudo) ?? []).filter(
                (p) => pending.has(p.id_estudo_ponto)
            );
            const ordinated = possibilities.sort(
                (a, b) => (WEIGHT_PRIORIRY[b.prioridade ?? "normal"] ?? 1) - (WEIGHT_PRIORIRY[a.prioridade ?? "normal"] ?? 1)
            );
            const covered = capability === Infinity ? ordinated : ordinated.slice(0, capability);
            const score = covered.reduce((s, p) => s + (WEIGHT_PRIORIRY[p.prioridade ?? "normal"] ?? 1), 0);
            if (!best || score > best.score) best = {candidate: c, covered, score};
        }

        if (!best || best.covered.length === 0) break;

        const choosedCandidate = best.candidate;
        best.covered.forEach((p) => pending.delete(p.id_estudo_ponto));
        gateways.push({
            candidato: choosedCandidate,
            atendimentos: best.covered.map((p) => {
                const MDistance = this.MetersDistance(
                    choosedCandidate.latitude,
                    choosedCandidate.longitude,
                    p.latitude,
                    p.longitude
                );
                return {
                    ponto: p,
                    distanciaM: MDistance,
                    nivelSinalDbm: this.DBMSinalLevel(MDistance, RFProfile.frequencia_mhz, RFProfile.potencia_transmissao_dbm),
                };
            }),
        });
        rest =  rest.filter((c) => c.id_estudo_ponto !== choosedCandidate.id_estudo_ponto);
    }
    return {gateways, pontosNaoCobertos: [...pending.values()]};
  }
}