import { supabase } from "../database/supabase.js";

export class ValidationService {
    async verifyRecord(table: string, column: string, value: number, entity: string): Promise<void> {
        const { data, error } = await supabase.from(table)
        .select(column).eq(column, value).maybeSingle();
        
        if (error) throw new Error(`Erro ao consultar ${entity}: ${error.message}.`);
        if (!data) throw new Error(`${entity} não encontrada.`);
    }
}