import { supabase } from "../lib/supabase.js";

import type {
    CriarUsuario,
    Usuario
} from "../models/usuario.js";

export async function criarUsuario(
    dados: CriarUsuario
): Promise<Usuario> {

    const usuario = {
        username: dados.username.trim(),
        email: dados.email.trim(),
        senha_hash: dados.senha_hash
    };

    const { data, error } = await supabase
        .from("usuarios")
        .insert(usuario)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Erro ao criar usuário: ${error.message}`
        );
    }

    return data as Usuario;
}