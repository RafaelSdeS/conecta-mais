/**
 * Retorna a tecnologia recomendada para um município com base
 * na distância ao backhaul e número de domicílios.
 */
export function getTechRecommendation(distKm: number, domicilios: number): string {
  if (distKm > 45 && domicilios < 15000) return 'FWA 5G / satélite de alta capacidade'
  if (domicilios > 30000)                return 'FTTH'
  return 'FTTH com backhaul compartilhado'
}

/**
 * Modelo financeiro simplificado (mesmas fórmulas do protótipo).
 * Usado no drawer quando a API não está disponível.
 */
export interface FinancialCalc {
  capex:  number
  back:   number
  b2c:    number
  b2g:    number
  ebitda: number
  pay:    number
}

interface CalcLevers { fust: boolean; tcu: boolean; enec: boolean }

export function calcFinancial(
  homes: number,
  dist: number,
  schools: number,
  tcuMun: boolean,
  levers: CalcLevers,
): FinancialCalc {
  const acesso = homes * 477 / 1e6
  const back   = (levers.tcu && tcuMun) ? 0 : Math.min(dist, 60) * 61.8 / 1000
  const cl     = homes * 0.25
  const ativ   = cl * 500 / 1e6
  const capex  = acesso + back + ativ
  const b2c    = cl * 87.7 * 12 / 1e6
  const b2g    = levers.enec ? schools * 1200 * 12 / 1e6 : 0
  const ebitda = b2c * 0.4 + b2g * 0.5
  let   pay    = ebitda > 0 ? capex / ebitda : 99
  if (levers.fust) pay *= 0.93
  return { capex, back, b2c, b2g, ebitda, pay }
}
