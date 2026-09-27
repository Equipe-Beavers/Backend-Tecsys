export type TipoDelimitacao =
    | "desenho"
    | "selecao"
    | "mancha";

export type StatusEstudo =
    | "AGUARDANDO_SELECAO"
    | "DEFINITIVO"
    | "CRIANDO_CENARIO"
    | "CENARIO_EM_RASCUNHO"
    | "EM_COMPARACAO";

export type PapelAtivo =
    | "candidato"
    | "interesse"
    | "ambos";

export interface TipoAtivoSelecionado {
    tipo_ativo: string;
    papel: PapelAtivo;
    quantidade: number;
}

export interface Estudo {
    id_estudo: number;
    id_usuario: number;

    tipo_delimitacao: TipoDelimitacao;

    uf: string | null;
    municipio: string | null;
    bairro: string | null;

    geom: unknown | null;

    nome: string;
    descricao: string | null;

    distribuidora: string | null;
    versao_bdgd: string | null;
    nome_base_externa: string | null;

    tipos_ativo_selecionados: TipoAtivoSelecionado[] | null;

    status: StatusEstudo;

    criado_em: string;
    atualizado_em: string | null;
}

export interface CriarEstudo {
    id_usuario: number;

    tipo_delimitacao: TipoDelimitacao;

    uf?: string | null;
    municipio?: string | null;
    bairro?: string | null;

    geom?: unknown | null;

    nome: string;
    descricao?: string | null;

    distribuidora?: string | null;
    versao_bdgd?: string | null;
    nome_base_externa?: string | null;

    tipos_ativo_selecionados?: TipoAtivoSelecionado[] | null;

    status?: StatusEstudo;
}