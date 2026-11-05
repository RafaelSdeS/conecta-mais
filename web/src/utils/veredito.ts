/**
 * Veredito para quem decide em campo (funções puras).
 * Indica se vale levar o município adiante; não é aprovação de investimento.
 * Regras e limiares são hipóteses a validar nos playbacks (docs/design-thinking.md).
 */

import type { CampoQualidade, FinanceiroLinha, Municipio } from '../api/client'
import { fmtAnos, fmtMi, fmtN0 } from './format'

export const PAYBACK_MAX_ANOS = 6

export type NivelVeredito = 'avancar' | 'condicao' | 'nao' | 'pendente'
export type FinanceiroVeredito = Pick<FinanceiroLinha, 'capex' | 'payback' | 'npv'>

export interface Veredito {
  titulo: string
  nivel: NivelVeredito
  explicacao: string
  proximosPassos: string[]
  /** Ordem nas listas de prioridades: menor vem primeiro. */
  ordem: number
}

const REGISTRAR = 'Registrar sua recomendação para o comitê'

export function veredito(m: Municipio, fin?: FinanceiroVeredito): Veredito {
  if (m.quadrante === 'Q4') {
    return {
      titulo: 'Não priorizar agora',
      nivel: 'nao',
      explicacao: 'Mercado e impacto educacional abaixo da mediana do país.',
      proximosPassos: ['Manter em acompanhamento; não há ação imediata'],
      ordem: 4,
    }
  }
  if (m.quadrante === 'Q2a' || m.quadrante === 'Q2b') {
    return {
      titulo: 'Só com apoio',
      nivel: 'condicao',
      explicacao: 'Impacto educacional alto e mercado fraco: depende de subsídio, parceiro ou satélite.',
      proximosPassos: [
        'Checar programas e subsídios com a área regulatória',
        'Procurar parceiros entre os provedores locais do kit',
        REGISTRAR,
      ],
      ordem: 2,
    }
  }
  if (!fin) {
    return { titulo: 'Calculando retorno…', nivel: 'pendente', explicacao: '', proximosPassos: [], ordem: 5 }
  }
  const retornoOk = fin.payback != null && fin.payback <= PAYBACK_MAX_ANOS
  if (m.quadrante === 'Q1') {
    return retornoOk
      ? {
          titulo: 'Levar adiante',
          nivel: 'avancar',
          explicacao: `Mercado e impacto altos, com retorno em até ${PAYBACK_MAX_ANOS} anos.`,
          proximosPassos: [
            'Confirmar custos e adesão locais na visita',
            'Visitar as escolas prioritárias do kit',
            REGISTRAR,
          ],
          ordem: 0,
        }
      : {
          titulo: 'Só com apoio',
          nivel: 'condicao',
          explicacao: `Mercado e impacto altos, mas o retorno passa de ${PAYBACK_MAX_ANOS} anos: precisa de subsídio, parceiro ou custo menor.`,
          proximosPassos: [
            'Checar programas e subsídios com a área regulatória',
            'Procurar parceiros entre os provedores locais do kit',
            REGISTRAR,
          ],
          ordem: 2,
        }
  }
  return retornoOk
    ? {
        titulo: 'Levar adiante pelo comercial',
        nivel: 'avancar',
        explicacao: `Mercado forte e retorno em até ${PAYBACK_MAX_ANOS} anos; o impacto educacional é menor.`,
        proximosPassos: [
          'Confirmar adesão e concorrência local na visita',
          'Ver os provedores locais no kit',
          REGISTRAR,
        ],
        ordem: 1,
      }
    : {
        titulo: 'Avaliar compra ou parceria',
        nivel: 'condicao',
        explicacao: `Mercado forte, mas construir não se paga em ${PAYBACK_MAX_ANOS} anos: compare com os provedores locais.`,
        proximosPassos: [
          'Ver os provedores locais no kit e avaliar compra ou parceria',
          'Comparar com construir nos detalhes financeiros',
          REGISTRAR,
        ],
        ordem: 3,
      }
}

/** Até 3 motivos com os números que sustentam o veredito. */
export function motivos(m: Municipio, fin?: FinanceiroVeredito): string[] {
  const domicilios = Math.max(m.domicilios_urbanos ?? 0, 1)
  const semFibra = Math.max(0, 1 - (m.acessos_fibra ?? 0) / domicilios)
  const lista = [`${fmtN0(domicilios)} domicílios, cerca de ${(semFibra * 100).toFixed(0)}% sem fibra`]

  const escolas = m.escolas_sem_internet_aprendizagem ?? 0
  lista.push(
    escolas > 0
      ? `${fmtN0(m.alunos_sem_internet)} alunos em ${fmtN0(escolas)} escolas sem internet para aprendizagem`
      : 'Nenhuma escola sem internet para aprendizagem no Censo Escolar',
  )

  const fibra = m.tem_backhaul_fibra ? 'já tem fibra de transporte' : `fibra de transporte a ${(m.dist_backhaul_km ?? 0).toFixed(0)} km`
  if (fin) {
    const retorno = fin.payback == null ? 'sem retorno no horizonte' : `retorno em ${fmtAnos(fin.payback)}`
    lista.push(`Investimento de ${fmtMi(fin.capex)}, ${retorno}; ${fibra}`)
  } else {
    lista.push(fibra[0].toUpperCase() + fibra.slice(1))
  }
  return lista
}

/** Aviso quando o retorno financeiro não fecha; nunca fica escondido atrás do veredito. */
export function alertaFinanceiro(fin?: FinanceiroVeredito): string | null {
  if (!fin || fin.npv >= 0) return null
  return `Com as premissas atuais, o valor presente do projeto é negativo (VPL de ${fmtMi(fin.npv)}). Confirme custos e adesão locais antes de comprometer investimento.`
}

const NOME_CAMPO: Record<string, string> = {
  velocidade_medida_mbps: 'velocidade real das escolas',
  acordo_migracao: 'Acordo TCU',
  fust_elegivel: 'elegibilidade ao FUST',
  eace_escolas: 'programa EACE',
  ivs: 'vulnerabilidade social (média do estado)',
  elevacao_media_m: 'relevo (ponto central do município)',
}

/** O que os dados não cobrem, em linguagem simples. */
export function limitesDados(qualidade: CampoQualidade[]): string | null {
  const nomes = (tipo: string) =>
    qualidade.filter((q) => q.tipo === tipo).map((q) => NOME_CAMPO[q.campo] ?? q.campo).join(', ')
  const partes = [
    nomes('neutro') && `Sem dados de: ${nomes('neutro')}.`,
    nomes('aproximado') && `Aproximados: ${nomes('aproximado')}.`,
  ].filter(Boolean)
  return partes.length ? partes.join(' ') : null
}
