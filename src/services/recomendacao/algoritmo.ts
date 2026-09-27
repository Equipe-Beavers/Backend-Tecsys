import type { EstudoPonto } from "../../models/estudo-ponto.js";
import type { PerfilRf } from "../../models/perfil-rf.js";
import { distanciaMetros, nivelSinalDbm, alcanceMaximoM } from "./propagacao.js";

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

const PESO_PRIORIDADE: Record<string, number> = { critico: 3, alta: 2, normal: 1 };

export function calcularRecomendacao(
  candidatos: EstudoPonto[],
  pontosInteresse: EstudoPonto[],
  perfil: PerfilRf
): ResultadoCalculo {
  const alcance = alcanceMaximoM(perfil);
  const capacidade = perfil.capacidade_max_equipamentos ?? Infinity;

  const pendentes = new Map(pontosInteresse.map((p) => [p.id_estudo_ponto, p]));

  const alcancePorCandidato = new Map<number, EstudoPonto[]>();
  for (const c of candidatos) {
    const dentro = pontosInteresse.filter(
      (p) => distanciaMetros(c.latitude, c.longitude, p.latitude, p.longitude) <= alcance
    );
    alcancePorCandidato.set(c.id_estudo_ponto, dentro);
  }

  const gateways: GatewayCalculado[] = [];
  let restantes = [...candidatos];

  while (pendentes.size > 0 && restantes.length > 0) {
    let melhor: { candidato: EstudoPonto; cobertos: EstudoPonto[]; score: number } | null = null;

    for (const c of restantes) {
      const possiveis = (alcancePorCandidato.get(c.id_estudo_ponto) ?? []).filter((p) =>
        pendentes.has(p.id_estudo_ponto)
      );
      const ordenados = possiveis.sort(
        (a, b) =>
          (PESO_PRIORIDADE[b.prioridade ?? "normal"] ?? 1) -
          (PESO_PRIORIDADE[a.prioridade ?? "normal"] ?? 1)
      );
      const cobertos = capacidade === Infinity ? ordenados : ordenados.slice(0, capacidade);
      const score = cobertos.reduce((s, p) => s + (PESO_PRIORIDADE[p.prioridade ?? "normal"] ?? 1), 0);
      if (!melhor || score > melhor.score) melhor = { candidato: c, cobertos, score };
    }

    if (!melhor || melhor.cobertos.length === 0) break;

    const candidatoEscolhido = melhor.candidato;
    melhor.cobertos.forEach((p) => pendentes.delete(p.id_estudo_ponto));
    gateways.push({
      candidato: candidatoEscolhido,
      atendimentos: melhor.cobertos.map((p) => {
        const distanciaM = distanciaMetros(
          candidatoEscolhido.latitude,
          candidatoEscolhido.longitude,
          p.latitude,
          p.longitude
        );
        return {
          ponto: p,
          distanciaM,
          nivelSinalDbm: nivelSinalDbm(distanciaM, perfil.frequencia_mhz, perfil.potencia_transmissao_dbm),
        };
      }),
    });
    restantes = restantes.filter((c) => c.id_estudo_ponto !== candidatoEscolhido.id_estudo_ponto);
  }

  return { gateways, pontosNaoCobertos: [...pendentes.values()] };
}