import { pool } from "../database/pool.js";
import {
  createInstallCriterionQuery, listInstallCriteriaQuery, getInstallCriterionQuery,
  updateInstallCriterionQuery, deleteInstallCriterionQuery, lockInstallCriterionQuery,
  beginCriterionTransactionQuery, commitCriterionTransactionQuery, rollbackCriterionTransactionQuery,
} from "../database/queries.js";
import type { CreateInstallCriterionDTO, InstallCriterionDTO, ListInstallCriteriaDTO } from "../interface/InstallCriterionDTO.js";
import { InstallCriterionError } from "../utils/InstallCriterionError.js";
import { InstallCriterionUtils } from "../utils/InstallCriterionUtils.js";

import { InstallCriterionValidation } from "../utils/InstallCriterionValidation.js";

export class InstallCriterionService {
  private readonly validation = new InstallCriterionValidation();
  private readonly utils = new InstallCriterionUtils();

  async createInstallCriterion(input: CreateInstallCriterionDTO): Promise<InstallCriterionDTO> {
    try {
      this.validation.Validate(input);
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
      this.validation.Validate(input);
      if (Object.hasOwn(input, "tipos_elementos_permitidos") || Object.hasOwn(input, "tipos_elementos_proibidos")) {
        return await this.updateAssetSelections(id, input);
      }
      const { rows } = await pool.query(updateInstallCriterionQuery, [id, this.utils.PrepareData(input)]);
      if (!rows[0]) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
      return this.utils.MapRow(rows[0]);
    } catch (error) {
      return this.utils.RethrowDatabaseError(error);
    }
  }

  private async updateAssetSelections(id: number, input: Partial<CreateInstallCriterionDTO>): Promise<InstallCriterionDTO> {
    const client = await pool.connect();
    try {
      await client.query(beginCriterionTransactionQuery);
      const existing = await client.query(lockInstallCriterionQuery, [id]);
      if (!existing.rows[0]) throw new InstallCriterionError(404, "Critério de instalação não encontrado.");
      this.validation.Validate({ ...existing.rows[0], ...input });
      const { rows } = await client.query(updateInstallCriterionQuery, [id, this.utils.PrepareData(input)]);
      const result = this.utils.MapRow(rows[0]);
      await client.query(commitCriterionTransactionQuery);
      return result;
    } catch (error) {
      await client.query(rollbackCriterionTransactionQuery);
      throw error;
    } finally {
      client.release();
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