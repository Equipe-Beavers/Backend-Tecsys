import { pool } from "../database/pool.js";
import { createStudyQuery, listStudiesQuery, getStudyQuery, updateStudyQuery, deleteStudyQuery } from "../database/queries.js";
import type { CriarEstudoPonto, EstudoPonto } from "../interface/estudo-ponto.js";
import type { CriarEstudo, Estudo, UpdateStudyDTO } from "../interface/estudo.js";
import { StudyError } from "../utils/StudyError.js";
import { ValidationService } from "./ValidationService.js";

export class StudyService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

    async createStudy(studyData: CriarEstudo) {
        const estudo = {
        id_usuario: studyData.id_usuario,
        id_perfil_rf: studyData.id_perfil_rf,
        id_criterio_instalacao: studyData.id_criterio_instalacao,
        tipo_delimitacao: studyData.tipo_delimitacao,
        uf: studyData.uf ?? null,
        municipio: studyData.municipio ?? null,
        bairro: studyData.bairro ?? null,
        geom: studyData.geom ?? null,
        nome: studyData.nome.trim(),
        descricao: studyData.descricao?.trim() || null,
        distribuidora: studyData.distribuidora?.trim() || null,
        versao_bdgd: studyData.versao_bdgd?.trim() || null,
        nome_base_externa: studyData.nome_base_externa?.trim() || null,
        tipos_ativo_selecionados: studyData.tipos_ativo_selecionados ?? null,
        status: studyData.status ?? "AGUARDANDO_SELECAO",
        };

        const { rows } = await pool.query(createStudyQuery, [JSON.stringify(estudo)]);
        if (!rows[0]) {
            throw new Error("Selecione um perfil RF e um critério de instalação pertencentes ao usuário do estudo.");
        }
        return this.mapStudy(rows[0]);
    }

    async listStudies(userId?: number): Promise<Estudo[]> {
        const { rows } = await pool.query(listStudiesQuery, [userId ?? null]);
        return rows.map((row) => this.mapStudy(row));
    }

    async getStudy(id: number): Promise<Estudo> {
        const { rows } = await pool.query(getStudyQuery, [id]);
        if (!rows[0]) throw new StudyError(404, "Estudo não encontrado.");
        return this.mapStudy(rows[0]);
    }

    async updateStudy(id: number, input: UpdateStudyDTO): Promise<Estudo> {
        const values = { ...input };
        if (values.nome !== undefined) values.nome = values.nome.trim();
        if (values.descricao !== undefined) values.descricao = values.descricao?.trim() || null;
        const { rows } = await pool.query(updateStudyQuery, [id, JSON.stringify(values)]);
        if (!rows[0]) {
            await this.getStudy(id);
            throw new StudyError(400, "Selecione um perfil RF e um critério de instalação pertencentes ao usuário do estudo.");
        }
        return this.mapStudy(rows[0]);
    }

    async deleteStudy(id: number): Promise<void> {
        try {
            const { rows } = await pool.query(deleteStudyQuery, [id]);
            if (!rows[0]) throw new StudyError(404, "Estudo não encontrado.");
        } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
                throw new StudyError(409, "Não é possível excluir um estudo vinculado a outros registros.");
            }
            throw error;
        }
    }

    private mapStudy(row: Record<string, unknown>): Estudo {
        return {
            ...row,
            id_estudo: Number(row.id_estudo),
            id_usuario: Number(row.id_usuario),
            id_perfil_rf: Number(row.id_perfil_rf),
            id_criterio_instalacao: Number(row.id_criterio_instalacao),
        } as Estudo;
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

    const values = [
      studyData.id_estudo,
      studyData.origem,
      studyData.id_ativo_bdgd ?? null,
      studyData.tipo_ativo ?? null,
      studyData.rotulo ?? null,
      studyData.papel,
      studyData.prioridade ?? null,
      studyData.latitude,
      studyData.longitude,
      studyData.relevo_m ?? null,
      studyData.atributos ?? null,
      JSON.stringify(geom),
    ];

    const query = `
      INSERT INTO estudo_pontos
      (id_estudo, origem, id_ativo_bdgd, tipo_ativo, rotulo, papel, prioridade, latitude, longitude, relevo_m, atributos, geom)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        ST_GeomFromGeoJSON($12)
      ) RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (!result.rows[0]) throw new Error("Não foi possível criar o ponto de estudo.");
    return result.rows[0] as EstudoPonto;
  }
}
