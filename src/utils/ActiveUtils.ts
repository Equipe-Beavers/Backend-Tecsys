import {
  assetTypes,
  type Asset,
  type AssetRow,
  type AssetType,
} from "../interface/active-repository.js";

export class ActiveUtils {
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

  parseCoordinate(value: string | undefined, name: string): number {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
          throw new Error(`Parâmetro '${name}' deve ser numérico.`);
      }
      return parsed;
  }

  parseTypes(value: string | undefined): AssetType[] | undefined {
      if (!value) return undefined;
      const types = value.split(",").map((type) => type.trim().toUpperCase());
      if (types.length === 0 || types.some((type) => !assetTypes.includes(type as AssetType))) {
          throw new Error(`Tipos inválidos. Valores permitidos: ${assetTypes.join(", ")}.`);
      }

      return types as AssetType[];
  }

  parseLimit(value: string | undefined): number {
      if (value === undefined) return 500;
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
          throw new Error("Parâmetro 'limit' deve ser um inteiro entre 1 e 5000.");
      }

      return limit;
  }

  parseDeviceTypeIds(value: string | undefined): number[] | undefined {
      if (!value) return undefined;
      const ids = value.split(",").map((item) => Number(item.trim()));
      if (
          ids.length === 0 ||
          ids.some((id) => !Number.isInteger(id) || id < 0 || id > 43)
      ) {
          throw new Error("Tipos de dispositivos inválidos. Use códigos inteiros entre 0 e 43.");
      }
      return ids;
  }

  parseDistributors(value: string | undefined): string[] | undefined {
      if (!value) return undefined;
      const values = value.split(",").map((item) => item.trim());
      if (values.length === 0 || values.some((item) => item.length === 0)) {
          throw new Error("Distribuidoras inválidas.");
      }
      return values;
  }

}
