/**
 * Retorna a tecnologia recomendada para um município com base
 * na distância ao backhaul e número de domicílios.
 */
export function getTechRecommendation(distKm: number, domicilios: number): string {
  if (distKm > 45 && domicilios < 15000) return 'FWA 5G / satélite de alta capacidade'
  if (domicilios > 30000)                return 'FTTH'
  return 'FTTH com backhaul compartilhado'
}
