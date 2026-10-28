/**
 * chatService — lógica de resposta do agente de justificativa.
 *
 * Hoje: mock local com as mesmas respostas do protótipo HTML.
 * Para conectar ao watsonx.ai Granite do Chris: substitua apenas
 * a função `getAnswer` por uma chamada à API real — a UI não muda.
 */

import type { Municipio } from '../api/client'
import { fmtMi, fmtN0 } from './format'
import { calcFinancial } from './calculation'

export interface ChatContext {
  municipios:  Municipio[]
  portfolio:   Municipio[]
  levers:      { fust: boolean; tcu: boolean; enec: boolean }
  budget:      number
}

export interface ChatAnswer {
  text:   string   // pode conter HTML simples (<b>, <br>)
  source: string
}

// ── Mock local ────────────────────────────────────────────────────────────────

function top2Viáveis(ctx: ChatContext): [Municipio | null, Municipio | null] {
  const viáveis = ctx.municipios
    .map((m) => {
      const r = calcFinancial(
        m.domicilios_urbanos ?? 5000,
        m.dist_backhaul_km ?? 50,
        m.escolas_sem_internet_aprendizagem ?? 0,
        m.acordo_migracao ?? false,
        ctx.levers,
      )
      return { m, pay: r.pay, capex: r.capex }
    })
    .filter((x) => x.pay <= 6)
    .sort((a, b) => (b.m.matriculas_publicas ?? 0) / b.capex - (a.m.matriculas_publicas ?? 0) / a.capex)

  return [viáveis[0]?.m ?? null, viáveis[1]?.m ?? null]
}

function mockAnswer(q: string, ctx: ChatContext): ChatAnswer {
  const ql = q.toLowerCase()
  const [x, y] = top2Viáveis(ctx)

  // Semiárido / estudantes
  if (ql.includes('semi') || ql.includes('estudantes')) {
    const semi = ctx.municipios
      .map((m) => {
        const r = calcFinancial(
          m.domicilios_urbanos ?? 5000,
          m.dist_backhaul_km ?? 50,
          m.escolas_sem_internet_aprendizagem ?? 0,
          m.acordo_migracao ?? false,
          ctx.levers,
        )
        return { m, pay: r.pay, capex: r.capex }
      })
      .filter(({ m, pay }) => (m.lon ?? 0) > -42 && (m.lat ?? 0) > -13 && pay < 5)
      .sort((a, b) => (b.m.matriculas_publicas ?? 0) / b.capex - (a.m.matriculas_publicas ?? 0) / a.capex)
      .slice(0, 3)

    if (!semi.length) {
      return {
        text:   'Nenhum município do semiárido atinge payback abaixo de 5 anos com as alavancas atuais. Ligue FUST, TCU e ENEC no topo da página.',
        source: 'Fonte: modelo Conecta+ · Confiança: média',
      }
    }
    return {
      text: 'Top 3 do semiárido por matrículas conectadas por real investido (payback abaixo de 5 anos):<br>' +
        semi.map(({ m, pay, capex }) =>
          `• <b>${m.nome}</b>: ${fmtN0(m.matriculas_publicas)} matrículas, payback ${pay.toFixed(1)} anos, CapEx ${fmtMi(capex)}`
        ).join('<br>'),
      source: 'Fontes: INEP Censo Escolar, Anatel, IBGE · Confiança: 78%',
    }
  }

  // Priorização
  if (ql.includes('priorizar') || ql.includes('por que') || ql.includes('x sobre')) {
    if (!x || !y) {
      return {
        text:   'Não há municípios viáveis suficientes no cenário atual para comparar. Ajuste o orçamento ou as alavancas.',
        source: 'Modelo Conecta+ · Confiança: baixa',
      }
    }
    const xCalc = calcFinancial(x.domicilios_urbanos ?? 5000, x.dist_backhaul_km ?? 50, x.escolas_sem_internet_aprendizagem ?? 0, x.acordo_migracao ?? false, ctx.levers)
    const yCalc = calcFinancial(y.domicilios_urbanos ?? 5000, y.dist_backhaul_km ?? 50, y.escolas_sem_internet_aprendizagem ?? 0, y.acordo_migracao ?? false, ctx.levers)
    return {
      text: `Recomendo <b>${x.nome}</b> sobre <b>${y.nome}</b>: ${fmtN0(x.matriculas_publicas)} matrículas` +
        `${x.acordo_migracao ? ', backhaul financiado pelo Acordo TCU' : ''}. ` +
        `Payback de ${xCalc.pay.toFixed(1)} contra ${yCalc.pay.toFixed(1)} anos.`,
      source: 'Fontes: Censo Escolar INEP, Anatel SMP/SCM, Acordo TCU · Confiança: 82% · Incerteza: distância ao backhaul por centroide',
    }
  }

  // FUST
  if (ql.includes('fust')) {
    return {
      text:   'O FUST/BNDES (PAR 2025) oferece R$ 1,2 bi reembolsável a TR + 1,0–1,45% a.a. e R$ 52 mi não reembolsável, reduzindo o custo de capital frente ao WACC privado de 14–16%.',
      source: 'Fonte: BNDES PAR 2025 · Confiança: alta',
    }
  }

  // TCU
  if (ql.includes('tcu')) {
    return {
      text:   'O Acordo TCU–Vivo prevê R$ 4,5 bi: backhaul em 121 municípios, 4G/5G em 649 localidades e 895 escolas até 2026. Tratado como parâmetro exógeno no modelo.',
      source: 'Fonte: Acordo TCU · Confiança: alta',
    }
  }

  // Default
  return {
    text:   `Posso comparar municípios, listar o semiárido, explicar o FUST ou o Acordo TCU. No cenário atual, ${ctx.portfolio.length} municípios cabem no orçamento de R$ ${ctx.budget} mi.`,
    source: 'Agente de Justificativa · watsonx.governance',
  }
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

/**
 * Retorna a resposta do agente para uma pergunta.
 * Troque esta implementação por uma chamada à API do Chris quando disponível.
 */
export async function getAnswer(question: string, ctx: ChatContext): Promise<ChatAnswer> {
  // Simula latência de rede (600–900ms)
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 300))
  return mockAnswer(question, ctx)
}
