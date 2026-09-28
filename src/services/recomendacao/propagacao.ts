export function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}


function perdaPercursoDb(distanciaKm: number, freqMhz: number): number {
  if (distanciaKm <= 0) return 0;
  return 20 * Math.log10(distanciaKm) + 20 * Math.log10(freqMhz) + 32.44;
}

export function nivelSinalDbm(distanciaM: number, freqMhz: number, potenciaDbm: number): number {
  const distanciaKm = distanciaM / 1000;
  return potenciaDbm - perdaPercursoDb(distanciaKm, freqMhz);
}


export function alcanceMaximoM(perfil: {
  alcance_estimado_m: number | null;
  frequencia_mhz: number;
  potencia_transmissao_dbm: number;
  sensibilidade_recepcao_dbm: number;
}): number {
  if (perfil.alcance_estimado_m != null) return perfil.alcance_estimado_m;

  const margemDb = perfil.potencia_transmissao_dbm - perfil.sensibilidade_recepcao_dbm;
  const distanciaKm = Math.pow(
    10,
    (margemDb - 20 * Math.log10(perfil.frequencia_mhz) - 32.44) / 20
  );
  return Math.max(0, distanciaKm * 1000);
}