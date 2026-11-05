/** Distância e municípios próximos (funções puras). */

export interface Ponto {
  lat: number
  lon: number
}

export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// ponytail: usa o centro do município, não o limite; na divisa pode errar, por isso a tela oferece os mais próximos
export function maisProximos<T extends Ponto>(lista: T[], origem: Ponto, quantidade: number): { item: T; km: number }[] {
  return lista
    .filter((m) => m.lat && m.lon)
    .map((item) => ({ item, km: distanciaKm(origem, item) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, quantidade)
}
