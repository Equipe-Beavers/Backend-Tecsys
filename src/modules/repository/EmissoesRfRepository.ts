import { pool } from "../../database/pool.js";
import type {
    EmissaoRfDTO,
    EmissoesRfBoundingBox,
    EmissoesRfListResponse,
} from "../../interface/emissoes-rf.js";

interface EmissaoRfRow {
    id: string;
    uid: string | null;
    source_key: string;
    fonte_dados: string;
    status: string | null;
    entidade: string | null;
    num_servico: string | null;
    num_estacao: string | null;
    municipio: string | null;
    uf: string | null;
    emissao: string | null;
    tecnologia: string | null;
    tipo_tecnologia: string | null;
    meio_acesso: string | null;
    frequencia_tx_mhz: number | null;
    frequencia_rx_mhz: number | null;
    potencia_transmissor_w: number | null;
    ganho_antena: number | null;
    azimute_graus: number | null;
    angulo_meia_potencia_graus: number | null;
    frente_costas: number | null;
    elevacao_graus: number | null;
    polarizacao: string | null;
    altura_antena_m: number | null;
    tipo_antena: string | null;
    latitude: number;
    longitude: number;
    data_licenciamento: Date | null;
    data_validade: Date | null;
}

/** Consulta registros técnicos individuais; não agrega emissões diferentes da mesma estação. */
export class EmissoesRfRepository {
    async listarPorArea(
        bbox: EmissoesRfBoundingBox,
        limit: number,
    ): Promise<EmissoesRfListResponse> {
        const values = [bbox.minLongitude, bbox.minLatitude, bbox.maxLongitude, bbox.maxLatitude];
        const where = `
            FROM public.emissoes_anatel
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4674)
              AND latitude BETWEEN $2 AND $4
              AND longitude BETWEEN $1 AND $3
        `;
        const totalResult = await pool.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total ${where}`,
            values,
        );
        const dataResult = await pool.query<EmissaoRfRow>(
            `SELECT id::text AS id, uid, source_key, fonte_dados, status, entidade,
                    num_servico, num_estacao, municipio, uf, emissao, tecnologia,
                    tipo_tecnologia, meio_acesso, frequencia_tx_mhz, frequencia_rx_mhz,
                    potencia_transmissor_w, ganho_antena, azimute_graus,
                    angulo_meia_potencia_graus, frente_costas, elevacao_graus,
                    polarizacao, altura_antena_m, tipo_antena, latitude, longitude,
                    data_licenciamento, data_validade
             ${where}
             ORDER BY frequencia_tx_mhz NULLS LAST, entidade NULLS LAST, num_estacao NULLS LAST
             LIMIT $5`,
            [...values, limit],
        );

        const nullableNumber = (v: number | null): number | null => v == null ? null : Number(v);
        const data: EmissaoRfDTO[] = dataResult.rows.map((r) => ({
            id: String(r.id),
            uid: r.uid,
            sourceKey: r.source_key,
            fonteDados: r.fonte_dados,
            status: r.status,
            entidade: r.entidade,
            numServico: r.num_servico,
            numEstacao: r.num_estacao,
            municipio: r.municipio,
            uf: r.uf,
            emissao: r.emissao,
            tecnologia: r.tecnologia,
            tipoTecnologia: r.tipo_tecnologia,
            meioAcesso: r.meio_acesso,
            frequenciaTxMHz: nullableNumber(r.frequencia_tx_mhz),
            frequenciaRxMHz: nullableNumber(r.frequencia_rx_mhz),
            potenciaTransmissorW: nullableNumber(r.potencia_transmissor_w),
            ganhoAntena: nullableNumber(r.ganho_antena),
            azimuteGraus: nullableNumber(r.azimute_graus),
            anguloMeiaPotenciaGraus: nullableNumber(r.angulo_meia_potencia_graus),
            frenteCostas: nullableNumber(r.frente_costas),
            elevacaoGraus: nullableNumber(r.elevacao_graus),
            polarizacao: r.polarizacao,
            alturaAntenaM: nullableNumber(r.altura_antena_m),
            tipoAntena: r.tipo_antena,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            dataLicenciamento: r.data_licenciamento?.toISOString().slice(0, 10) ?? null,
            dataValidade: r.data_validade?.toISOString().slice(0, 10) ?? null,
        }));

        return { data, total: Number(totalResult.rows[0]?.total ?? 0), limit };
    }
}
