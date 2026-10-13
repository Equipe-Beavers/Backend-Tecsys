import { pool } from "../database/pool.js";
import { supabase } from "../database/supabase.js";

export class ValidationService {
  async verifyRecord(
    table: string,
    column: string,
    value: number,
    entity: string,
  ): Promise<void> {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq(column, value)
      .maybeSingle();

    if (error)
      throw new Error(`Erro ao consultar ${entity}: ${error.message}.`);
    if (!data) throw new Error(`${entity} não encontrada.`);

    try {
        const query = `SELECT ${column} FROM ${table} WHERE ${column} = $1 LIMIT 1;`;
        const result = await pool.query(query, [value]);

        if (!result.rows[0]) throw new Error(`${entity} não encontrada.`)
    } catch (error: any) {
        if (error.message.includes('não encontrada') || error.message.includes('inválido')) {
            throw error;
        }
        throw new Error(`Erro ao consultar ${entity}: ${error.messsage}`);
    }
  }
}
