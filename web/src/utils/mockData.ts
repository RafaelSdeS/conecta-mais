/**
 * Gerador de municípios simulados — porta fiel do protótipo painel.html.
 * Usado apenas quando a API FastAPI não está disponível (dev sem backend).
 */

import type { Municipio } from '../api/client'

// Polígono aproximado da Bahia
const POLY = [
  [-44.2,-8.5],[-41.0,-9.0],[-38.5,-9.4],[-37.4,-11.5],[-38.0,-13.0],
  [-39.0,-15.0],[-39.2,-17.9],[-40.6,-18.3],[-41.0,-16.0],[-43.0,-15.5],
  [-44.5,-14.5],[-46.3,-13.3],[-46.0,-11.0],[-44.8,-10.0],
]
const LON_MIN = -46.6, LON_MAX = -37.2, LAT_MIN = -18.5, LAT_MAX = -8.3

function inside(lon: number, lat: number): boolean {
  let c = false
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i], [xj, yj] = POLY[j]
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c
  }
  return c
}

// LCG deterministico (mesmo seed do protótipo)
let seed = 42
function rnd() {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const PREFIX = ['São','Santa','Nova','Bom','Vila','Porto','Monte','Alto','Barra','Campo','Rio','Serra']
const SUFFIX  = ['Felipe','Rosa','Esperança','Jesus','Verde','Seguro','Branco','do Sul','Alegre','Grande','das Flores','Novo','Velho','do Norte','Formoso','Preciosa']

function quadrante(M: number, I: number, pay: number): string {
  const hM = M >= 50, hI = I >= 50
  if (hM && hI)  return 'Q1'
  if (!hM && hI) return pay <= 6 ? 'Q2a' : 'Q2b'
  if (hM && !hI) return 'Q3'
  return 'Q4'
}

export function generateMockMunicipios(): Municipio[] {
  // reset seed
  seed = 42

  // Gera PoPs
  const pops: { lon: number; lat: number }[] = []
  let tries = 0
  while (pops.length < 14 && tries++ < 5000) {
    const lo = LON_MIN + rnd() * (LON_MAX - LON_MIN)
    const la = LAT_MIN + rnd() * (LAT_MAX - LAT_MIN)
    if (inside(lo, la)) pops.push({ lon: lo, lat: la })
  }

  // Gera municípios
  const mun: Municipio[] = []
  tries = 0
  while (mun.length < 417 && tries++ < 100000) {
    const lo = LON_MIN + rnd() * (LON_MAX - LON_MIN)
    const la = LAT_MIN + rnd() * (LAT_MAX - LAT_MIN)
    if (!inside(lo, la)) continue

    let dmin = 1e9
    pops.forEach((p) => {
      const d = Math.hypot((p.lon - lo) * 105, (p.lat - la) * 111)
      if (d < dmin) dmin = d
    })

    const coastal  = lo > -39.5
    const hab      = Math.round(4000 + Math.pow(rnd(), 3) * 90000)
    const homes    = Math.round(hab / 3.4 * 0.8)
    const schools  = Math.max(2, Math.round(hab / 1700 + rnd() * 3))
    const mob      = Math.round(35 + rnd() * 40)
    const M        = Math.min(100, Math.round(Math.min(60, hab / 1500) + (coastal ? 15 : 0) + rnd() * 20 + (1 - Math.min(1, dmin / 120)) * 10))
    const I        = Math.min(100, Math.round(30 + rnd() * 45 + (lo < -41 ? 12 : 0) + (coastal ? -8 : 0) + Math.min(15, schools)))
    const deficit  = Math.round(schools * 270 * (0.3 + rnd() * 0.5))

    // Modelo financeiro simplificado
    const acesso  = homes * 477 / 1e6
    const back    = Math.min(dmin, 60) * 61.8 / 1000
    const cl      = homes * 0.25
    const ativ    = cl * 500 / 1e6
    const capex   = acesso + back + ativ
    const b2c     = cl * 87.7 * 12 / 1e6
    const ebitda  = b2c * 0.4
    const pay     = ebitda > 0 ? capex / ebitda : 99

    const nome = PREFIX[Math.floor(rnd() * PREFIX.length)] + ' ' + SUFFIX[Math.floor(rnd() * SUFFIX.length)]

    mun.push({
      id_municipio:                    String(2900000 + mun.length),
      nome,
      uf:                              'BA',
      lat:                             la,
      lon:                             lo,
      domicilios_urbanos:              homes,
      renda_media:                     800 + rnd() * 1200,
      acessos_fibra:                   Math.round(homes * 0.1 * rnd()),
      acessos_total_bl:                Math.round(homes * 0.2 * rnd()),
      market_share_vivo_movel:         mob / 100,
      hhi:                             rnd() * 5000 + 1000,
      ppp_share:                       rnd(),
      area_km2:                        100 + rnd() * 2000,
      elevacao_media_m:                50 + rnd() * 800,
      dist_backhaul_km:                Math.max(3, Math.round(dmin)),
      matriculas_publicas:             schools * 270,
      matriculas_rurais_pct:           rnd() * 0.4,
      velocidade_medida_mbps:          rnd() * 20,
      alunos_maior_turno_est:          schools * 150,
      escolas_sem_internet_aprendizagem: deficit > 400 ? Math.round(deficit / 270) : 0,
      ivs:                             0.3 + rnd() * 0.5,
      tem_backhaul_fibra:              rnd() > 0.7,
      acordo_migracao:                 false,
      ano_backhaul:                    null,
      fust_elegivel:                   rnd() > 0.5,
      eace_escolas:                    Math.round(rnd() * schools),
      score_M:                         M,
      score_I:                         I,
      score_C:                         Math.round(40 + rnd() * 60),
      score_A:                         Math.round(rnd() * 100),
      score_total:                     Math.round((M + I) / 2),
      quadrante:                       quadrante(M, I, pay),
    } as Municipio)
  }

  // Marca 121 municípios TCU
  ;[...mun]
    .sort((a, b) => ((b.score_I + (b.dist_backhaul_km ?? 0) / 3) - (a.score_I + (a.dist_backhaul_km ?? 0) / 3)))
    .slice(0, 121)
    .forEach((m) => { m.acordo_migracao = true })

  return mun
}
