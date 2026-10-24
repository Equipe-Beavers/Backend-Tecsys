import type { BoundingBox } from "../interface/region-repository.js";

export class RegionsUtils {
  normalizeName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  dsitributorLocalName(value: string): string {
    return value.trim().toUpperCase();
  }

  numero(query: string | undefined): number | undefined {
    if (query === undefined || query.trim() === "") return undefined;
    return Number.isFinite(Number(query)) ? Number(query) : undefined;
  }

  paginaEValida(query: string | undefined): number {
    return this.numero(query) === undefined
      ? 1
      : Math.max(Math.floor(Number(query)), 1);
  }

  boundingBox(query: {
    minLat?: string;
    maxLat?: string;
    minLng?: string;
    maxLng?: string;
  }): BoundingBox | undefined {
    const values = [this.numero(query.minLat), this.numero(query.maxLat), this.numero(query.minLng), this.numero(query.maxLng)];
    if (values.every((v) => v === undefined)) return undefined;
    if (values.some((v) => v === undefined)) return undefined;

    const [minLat, maxLat, minLng, maxLng] = values as [number, number, number, number];
    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180 || minLat > maxLat || minLng > maxLng) {
        return undefined;
    }
    return {minLat, maxLat, minLng, maxLng};
  };
}
