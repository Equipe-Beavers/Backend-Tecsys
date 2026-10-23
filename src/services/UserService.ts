import { supabase } from "../database/supabase.js";
import type { CriarUsuario, Usuario } from "../interface/usuario.js";

export class UserService {
    async createUser(userData: CriarUsuario): Promise<Usuario> {
        const usuario = {
            username: userData.username.trim(),
            email: userData.email.trim(),
            senha_hash: userData.senha_hash
        }

        const { data, error } = await supabase.from("usuarios")
        .insert(usuario).select().single();

        if (error) throw new Error(`Erro ao criar usuário: ${error.message}.`);
        return data as Usuario;
    }
}