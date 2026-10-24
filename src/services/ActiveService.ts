import { pool } from "../database/pool.js";
import { findAssetByIdQuery, findAssetsQuery, findDeviceTypesQuery, findDistributorsQuery } from "../database/queries/ativo_queries.js";
import type { Asset, AssetFilters, AssetRow, AssetsPage, DeviceTypeSummary, DistributorSummary } from "../interface/active-repository.js";
import { ActiveUtils } from "../utils/ActiveUtils.js";

export class ActiveService {
  private activeUtils: ActiveUtils;

  constructor() {
    this.activeUtils = new ActiveUtils();
  }

  async findAssets(filters: AssetFilters): Promise<AssetsPage> {
    const { text, values } = findAssetsQuery(filters);
    const result = await pool.query<AssetRow>(text, values);

    return {
      items: result.rows.map(this.activeUtils.mapRow),
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
    return row ? this.activeUtils.mapRow(row) : null;
  }
}
