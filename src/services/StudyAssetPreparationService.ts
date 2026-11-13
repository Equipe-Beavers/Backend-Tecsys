import { pool } from "../database/pool.js";
import { findStudyAssetsQuery } from "../database/queries/ativo_queries.js";

/** Limites operacionais explícitos. Nunca apresentar contagem parcial como total. */
const MAX_INTEREST = 3000;
const MAX_CANDIDATES = 25;

type BoundingRow = {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
};

type StudyAssetRow = {
  id: string;
  cod_id: string | null;
  tipo: string;
  latitude: number | string;
  longitude: number | string;
  atributos: Record<string, unknown> | null;
  papel: "ambos" | "interesse";
  total_interesse: number | string;
  total_candidatos: number | string;
};

export interface StudyAssetsPrepared {
  totalCandidates: number;
  importedCandidates: number;
}

export class StudyAssetPreparationService {
  /**
   * A geometria desenhada define a area; seus vertices nao sao ativos.
   * A BDGD e a fonte dos pontos de interesse e dos locais candidatos.
   * Todos os ativos da area sao pontos de interesse. Os tipos permitidos no
   * criterio de instalacao tambem sao candidatos (papel ambos).
   * Se o estudo ja recebeu pontos reais (CSV/manual/BDGD), preserva-os.
   */
  async prepare(studyId: number, criterionId: number | null = null): Promise<StudyAssetsPrepared> {
    const existing = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM estudo_pontos
       WHERE id_estudo = $1 AND COALESCE(atributos->>'tipo_ponto', '') <> 'vertice_area'`,
      [studyId],
    );
    if (Number(existing.rows[0]?.total ?? 0) > 0) {
      return { totalCandidates: 0, importedCandidates: 0 };
    }

    const bounds = await pool.query<BoundingRow>(
      `SELECT ST_XMin(geom::box3d) AS min_lon, ST_YMin(geom::box3d) AS min_lat,
              ST_XMax(geom::box3d) AS max_lon, ST_YMax(geom::box3d) AS max_lat
       FROM estudos WHERE id_estudo = $1 AND geom IS NOT NULL`,
      [studyId],
    );
    const bbox = bounds.rows[0];
    if (!bbox) {
      throw new Error("Estudo sem area geografica. Defina uma area ou cadastre pontos candidatos e de interesse.");
    }

    const query = findStudyAssetsQuery({
      minLongitude: Number(bbox.min_lon),
      minLatitude: Number(bbox.min_lat),
      maxLongitude: Number(bbox.max_lon),
      maxLatitude: Number(bbox.max_lat),
    }, studyId, MAX_INTEREST, MAX_CANDIDATES, criterionId);

    let rows: StudyAssetRow[];
    try {
      ({ rows } = await pool.query<StudyAssetRow>(query.text, query.values));
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      throw new Error(`Não foi possível consultar os ativos BDGD na região: ${description}`);
    }

    const totalInterest = Number(rows[0]?.total_interesse ?? 0);
    const totalCandidates = Number(rows[0]?.total_candidatos ?? 0);
    if (totalInterest > MAX_INTEREST) {
      throw new Error(`A area possui ${totalInterest} ativos de interesse (limite operacional ${MAX_INTEREST}). Reduza a area do estudo.`);
    }
    if (totalInterest === 0) {
      throw new Error("Nao foram encontrados ativos BDGD dentro da area selecionada.");
    }
    if (totalCandidates === 0) {
      throw new Error("O criterio de instalacao nao permite nenhum local candidato entre os tipos de ativos BDGD encontrados na area.");
    }

    const assets = rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      rotulo: r.cod_id ?? r.id,
      papel: r.papel,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      atributos: r.atributos ?? {},
    }));

    // Insercao em lote e idempotente para o mesmo estudo/ativo.
    await pool.query(
      `INSERT INTO estudo_pontos (
         id_estudo, origem, id_ativo_bdgd, tipo_ativo, rotulo, papel,
         prioridade, latitude, longitude, atributos, geom
       )
       SELECT $1, 'bdgd', LEFT(a.id, 60), a.tipo, LEFT(a.rotulo, 150),
              a.papel, 'normal', a.latitude, a.longitude, a.atributos,
              ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4674)
       FROM jsonb_to_recordset($2::jsonb) AS a(
         id text, tipo text, rotulo text, papel text,
         latitude double precision, longitude double precision, atributos jsonb
       )
       WHERE NOT EXISTS (
         SELECT 1 FROM estudo_pontos ep
         WHERE ep.id_estudo = $1 AND ep.id_ativo_bdgd = LEFT(a.id, 60)
       )`,
      [studyId, JSON.stringify(assets)],
    );

    return {
      totalCandidates,
      importedCandidates: rows.filter((r) => r.papel === "ambos").length,
    };
  }
}
