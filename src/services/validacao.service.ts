import { supabase } from "../lib/supabase.js";

export async function verificarRegistro(
    tabela: string,
    coluna: string,
    valor: number,
    entidade: string
): Promise<void> {
    const { data, error } = await supabase
        .from(tabela)
        .select(coluna)
        .eq(coluna, valor)
        .maybeSingle();

    if (error) {
        throw new Error(
            `Erro ao consultar ${entidade}: ${error.message}`
        );
    }

    if (!data) {
        throw new Error(`${entidade} não encontrado`);
    }
}
