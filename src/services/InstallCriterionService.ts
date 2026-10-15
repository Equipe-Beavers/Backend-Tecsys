import { pool } from "../database/pool.js";
import {
  createInstallCriterionQuery, listInstallCriteriaQuery, getInstallCriterionQuery,
  updateInstallCriterionQuery, deleteInstallCriterionQuery,
} from "../database/queries.js";
import type { CreateInstallCriterionDTO, InstallCriterionDTO, ListInstallCriteriaDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "../utils/InstallCriterionError.js";
import { InstallCriterionUtils } from "../utils/InstallCriterionUtils.js";

export class InstallCriterionService {
  private readonly utils = new InstallCriterionUtils();

  async createInstallCriterion(input: CreateInstallCriterionDTO): Promise<InstallCriterionDTO> {
    try {
      const { rows } = await pool.query(createInstallCriterionQuery, [this.utils.PrepareData(input)]);
      return this.utils.MapRow(rows[0]);
    } catch (error) {
      return this.utils.RethrowDatabaseError(error);
    }
  }

  async listInstallCriteria(input: ListInstallCriteriaDTO) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { rows } = await pool.query(listInstallCriteriaQuery, [input.id_usuario ?? null, limit, (page - 1) * limit]);
    return { data: rows.map((row) => this.utils.MapRow(row)), page, limit };
  }

  async getInstallCriterion(id: number): Promise<InstallCriterionDTO> {
    const { rows } = await pool.query(getInstallCriterionQuery, [id]);
    if (!rows[0]) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
    return this.utils.MapRow(rows[0]);
  }

  async updateInstallCriterion(id: number, input: Partial<CreateInstallCriterionDTO>): Promise<InstallCriterionDTO> {
    try {
      const { rows } = await pool.query(updateInstallCriterionQuery, [id, this.utils.PrepareData(input)]);
      if (!rows[0]) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
      return this.utils.MapRow(rows[0]);
    } catch (error) {
      return this.utils.RethrowDatabaseError(error);
    }
  }

  async deleteInstallCriterion(id: number): Promise<void> {
    try {
      const { rows } = await pool.query(deleteInstallCriterionQuery, [id]);
      if (!rows[0]) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
    } catch (error) {
      this.utils.RethrowDatabaseError(error, true);
    }
  }
}
