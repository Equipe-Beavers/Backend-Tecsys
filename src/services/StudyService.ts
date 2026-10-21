import { pool } from "../database/pool.js";
import type {
  CriarEstudoPonto,
  EstudoPonto,
} from "../interface/estudo-ponto.js";
import type { CriarEstudo, Estudo } from "../interface/estudo.js";
import { ValidationService } from "./ValidationService.js";

export class StudyService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  async createStudy(studyData: CriarEstudo): Promise<Estudo> {
    const estudo = [
      studyData.id_usuario,
      studyData.tipo_delimitacao,
      studyData.uf ?? null,
      studyData.municipio ?? null,
      studyData.bairro ?? null,
      studyData.geom ? JSON.stringify(studyData.geom) : null,
      studyData.nome.trim(),
      studyData.descricao?.trim() || null,
      studyData.distribuidora?.trim() || null,
      studyData.versao_bdgd?.trim() || null,
      studyData.nome_base_externa?.trim() || null,
      studyData.tipos_ativo_selecionados ? JSON.stringify(studyData.tipos_ativo_selecionados) : null,
      studyData.status ?? "AGUARDANDO_SELECAO",
    ];

    const query = `
      INSERT INTO estudos 
      (id_usuario, tipo_delimitacao, uf, municipio, bairro, geom, nome, descricao, distribuidora, versao_bdgd, nome_base_externa, tipos_ativo_selecionados, status)
      VALUES (
        $1, $2, $3, $4, $5, 
        CASE 
          WHEN $6::text IS NULL THEN NULL 
          ELSE ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 4674)
        END, 
        $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *;
    `;

    const result = await pool.query(query, estudo);

    if (!result.rows[0]) throw new Error("Erro ao criar estudo.");
    return result.rows[0] as Estudo;
  }

  async createStudyPoint(studyData: CriarEstudoPonto): Promise<EstudoPonto> {
    await this.validationService.verifyRecord(
      "estudos",
      "id_estudo",
      studyData.id_estudo,
      "Estudo",
    );

    const geom = {
      type: "Point",
      coordinates: [studyData.longitude, studyData.latitude],
    };

    const ponto = [
      studyData.id_estudo,
      studyData.origem,
      studyData.id_ativo_bdgd ?? null,
      studyData.tipo_ativo ?? null,
      studyData.rotulo ?? null,
      studyData.papel,
      studyData.prioridade ?? null,
      studyData.latitude,
      studyData.longitude,
      studyData.atributos ?? null,
      JSON.stringify(geom),
    ];

    const query = `
      INSERT INTO estudo_pontos 
      (id_estudo, origem, id_ativo_bdgd, tipo_ativo, rotulo, papel, prioridade, latitude, longitude, atributos, geom)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        ST_GeomFromGeoJSON($11)
      ) RETURNING *;
    `;
    
    const result = await pool.query(query, ponto);

    if (!result.rows[0]) throw new Error("Não foi possível criar o ponto de estudo.");
    return result.rows[0] as EstudoPonto;
  }
}