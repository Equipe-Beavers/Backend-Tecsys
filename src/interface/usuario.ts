export interface Usuario {
    id_usuario: number;
    username: string;
    email: string;
    senha_hash: string;
    criado_em: string;
    atualizado_em: string | null;
}

export interface CriarUsuario {
    username: string;
    email: string;
    senha: string;
}

export type UsuarioPublico = Omit<Usuario, "senha_hash">;

export interface LoginUsuario {
    email: string;
    senha: string;
}
