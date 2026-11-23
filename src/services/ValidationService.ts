import { pool } from "../database/pool.js";
import type { PoolClient } from "pg";

export class ValidationService {
  constructor(private database: Pick<PoolClient, "query"> = pool) {}

  async verifyRecord(
    table: string,
    column: string,
    value: number,
    entity: string,
  ): Promise<void> {
    try {
        const query = `SELECT ${column} FROM ${table} WHERE ${column} = $1 LIMIT 1;`;
        const result = await this.database.query(query, [value]);

        if (!result.rows[0]) throw new Error(`${entity} não encontrada.`)
    } catch (error: any) {
        if (error.message.includes('não encontrada') || error.message.includes('inválido')) {
            throw error;
        }
        throw new Error(`Erro ao consultar ${entity}: ${error.messsage}`);
    }
  }
}
