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
    senha_hash: string;
}