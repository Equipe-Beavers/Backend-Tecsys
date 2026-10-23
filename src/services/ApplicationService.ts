import { supabase } from "../database/supabase.js";
import { ApplicationUtils } from "../utils/ApplicationUtils.js";

export class ApplicationService {
    private applicationUtils: ApplicationUtils;

    constructor() {
        this.applicationUtils = new ApplicationUtils()
    }

    async listRegisters<T>(table: string): Promise<T[]> {
            const { data, error } = await supabase.from(table)
            .select("*");
    
            if (error) throw new Error(`Erro ao listar registros: ${error.message}.`);
            return ((data ?? []) as unknown[]).map((r)=> this.applicationUtils.hideSensitiveInputs<T>(r));
        }
    
        async findRegisterById<T>(table: string, columnId: string, id: number, entity: string): Promise<T> {
            const { data, error } = await supabase.from(table).select("*")
            .eq(columnId, id).maybeSingle();
    
            if (error) throw new Error(`Erro ao buscar ${entity}: ${error.message}`);
            if (!data) throw new Error(`${entity} não encontrado(a).`);
            return this.applicationUtils.hideSensitiveInputs<T>(data);
        }
    
        async updateRegister<T>(table: string, columnId: string, id: number, dataU: Record<string, unknown>, entity: string): Promise<T> {
            const { data, error } = await supabase.from(table).update(dataU).eq(columnId, id)
            .select().maybeSingle();
    
            if (error) throw new Error(`Erro ao atualizar ${entity}: ${error.message}`);
            if (!data) throw new Error(`${entity} não econtrado(a)`);
            return this.applicationUtils.hideSensitiveInputs<T>(data);
        }

        async deleteRegister<T>(table: string, columnId: string, id: number, entity: string): Promise<void> {
            const { data, error } = await supabase.from(table)
            .delete().eq(columnId, id).select(columnId).maybeSingle();

            if (error) throw new Error(`Erro ao excluir ${entity}: ${error.message}`);
            if (!data) throw new Error(`${entity} não encontrado(a)`);
        }
}