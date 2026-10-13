import { pool } from "../../database/pool.js";
import { findAssetsQuery, findAssetByIdQuery, findDeviceTypesQuery, findDistributorsQuery } from "../../database/queries/ativo_queries.js";
import type { Asset, AssetFilters, AssetRow, AssetsPage, DeviceTypeSummary, DistributorSummary } from "../../interface/active-repository.js";

export class ActiveRepository {
  mapRow(row: AssetRow): Asset {
    return {
      id: row.id,
      codId: row.cod_id,
      tipo: row.tipo,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      municipio: row.municipio,
      bairro: row.bairro,
      distribuidora: row.distribuidora,
      tipoDispositivoId: row.tipo_dispositivo_id,
      tipoDispositivoNome: row.tipo_dispositivo_nome,
      tipoDispositivoCategoria: row.tipo_dispositivo_categoria,
      atributos: row.atributos,
    };
  }

  async findAssets(filters: AssetFilters): Promise<AssetsPage> {
    const { text, values } = findAssetsQuery(filters);
    const result = await pool.query<AssetRow>(text, values);

    return {
      items: result.rows.map(this.mapRow),
      total: result.rows[0]?.total ?? 0,
    };
  }

  async findDistributors(): Promise<DistributorSummary[]> {
    const result = await pool.query<{
      nome: string;
      latitude: number;
      longitude: number;
      total_ativos: string;
    }>(findDistributorsQuery);

    return result.rows.map((row) => ({
      nome: row.nome,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      totalAtivos: Number(row.total_ativos),
    }));
  }

  async findDeviceTypes(): Promise<DeviceTypeSummary[]> {
    const result = await pool.query<{
      id: number;
      nome: string;
      categoria: string | null;
    }>(findDeviceTypesQuery);
    return result.rows;
  }

  async findAssetById(id: string): Promise<Asset | null> {
    const { text, values } = findAssetByIdQuery(id);
    const result = await pool.query<AssetRow>(text, values);

    const row = result.rows[0];
    return row ? this.mapRow(row) : null;
  }
}