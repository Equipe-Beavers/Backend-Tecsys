import { ActiveService } from './ActiveService.js';
import type { EstudoPonto } from '../interface/estudo-ponto.js';

export interface StudyLocation { municipio?: string | null; uf?: string | null; bairro?: string | null; }
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() && value.trim() !== 'Não informado' ? value.trim() : undefined;

export class GatewayMetadataService {
  constructor(private readonly assets = new ActiveService()) {}

  async attributes(point: EstudoPonto, study: StudyLocation): Promise<Record<string, unknown>> {
    const supplied = point.atributos ?? {};
    const asset = point.id_ativo_bdgd ? await this.assets.findAssetById(point.id_ativo_bdgd) : null;
    const attributes = { ...(asset?.atributos ?? {}), ...supplied };
    const locality = [asset?.bairro ?? study.bairro, asset?.municipio ?? study.municipio, study.uf]
      .filter(value => text(value)).join(' · ');
    const description = asset?.tipoDispositivoNome ?? asset?.tipo ?? point.tipo_ativo;
    return {
      ...attributes,
      origem: point.origem,
      local: text(attributes.local) ?? (locality || undefined),
      descricao_ativo: text(attributes.descricao_ativo) ?? description ??
        (point.origem === 'manual' ? 'Ponto definido manualmente' : undefined),
      // Não deduzir alimentador a partir de subestação ou código de conjunto.
      alimentador: text(attributes.alimentador) ?? text(attributes.ctmt) ?? text(attributes.CTMT),
    };
  }
}
