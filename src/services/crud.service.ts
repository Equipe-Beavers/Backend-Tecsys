import { supabase } from "../lib/supabase.js";

const CAMPOS_SENSIVEIS = ["senha_hash"];

function ocultarCamposSensiveis<T>(registro: unknown): T {
    if (!registro || typeof registro !== "object") {
        return registro as T;
    }

    const copia: Record<string, unknown> = { ...(registro as Record<string, unknown>) };

    for (const campo of CAMPOS_SENSIVEIS) {
        delete copia[campo];
    }

    return copia as T;
}

export async function listarRegistros<T>(
    tabela: string
): Promise<T[]> {
    const { data, error } = await supabase
        .from(tabela)
        .select("*");

    if (error) {
        throw new Error(`Erro ao listar registros: ${error.message}`);
    }

    return ((data ?? []) as unknown[]).map((registro) =>
        ocultarCamposSensiveis<T>(registro)
    );
}

export async function buscarRegistroPorId<T>(
    tabela: string,
    colunaId: string,
    id: number,
    entidade: string
): Promise<T> {
    const { data, error } = await supabase
        .from(tabela)
        .select("*")
        .eq(colunaId, id)
        .maybeSingle();

    if (error) {
        throw new Error(`Erro ao buscar ${entidade}: ${error.message}`);
    }

    if (!data) {
        throw new Error(`${entidade} não encontrado`);
    }

    return ocultarCamposSensiveis<T>(data);
}

export async function atualizarRegistro<T>(
    tabela: string,
    colunaId: string,
    id: number,
    dados: Record<string, unknown>,
    entidade: string
): Promise<T> {
    const { data, error } = await supabase
        .from(tabela)
        .update(dados)
        .eq(colunaId, id)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(`Erro ao atualizar ${entidade}: ${error.message}`);
    }

    if (!data) {
        throw new Error(`${entidade} não encontrado`);
    }

    return ocultarCamposSensiveis<T>(data);
}

export async function excluirRegistro(
    tabela: string,
    colunaId: string,
    id: number,
    entidade: string
): Promise<void> {
    const { data, error } = await supabase
        .from(tabela)
        .delete()
        .eq(colunaId, id)
        .select(colunaId)
        .maybeSingle();

    if (error) {
        throw new Error(`Erro ao excluir ${entidade}: ${error.message}`);
    }

    if (!data) {
        throw new Error(`${entidade} não encontrado`);
    }
}
