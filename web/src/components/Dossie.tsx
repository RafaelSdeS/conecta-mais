/**
 * Dossie — folha impressa do recorte atual para o comitê: cenário, KPIs, municípios do plano,
 * decisões registradas (com as exceções ao plano) e limites dos dados.
 * Fica escondido na tela; o botão "Dossiê (PDF)" do Painel liga body.imprimindo-dossie.
 */

import { useMemo } from 'react'
import { chaveNarrativa, type Decisao } from '../api/client'
import { useAppStore } from '../store/appStore'
import { DECISOES, TETO_PAYBACK_ANOS } from '../utils/constants'
import { descreveCenario, fmtAnos, fmtMi, fmtN0 } from '../utils/format'
import logo from '../assets/logo-texto.svg'

const th: React.CSSProperties = { textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--ln)', fontSize: 11, color: 'var(--mu)' }
const td: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid var(--ln)', fontSize: 11 }
const num: React.CSSProperties = { ...td, textAlign: 'right' }

export default function Dossie() {
  const budget     = useAppStore((s) => s.budget)
  const objetivo   = useAppStore((s) => s.objetivo)
  const params     = useAppStore((s) => s.params)
  const levers     = useAppStore((s) => s.levers)
  const filters    = useAppStore((s) => s.filters)
  const kpis       = useAppStore((s) => s.kpis)
  const portfolio  = useAppStore((s) => s.portfolio)
  const financeiro = useAppStore((s) => s.financeiro)
  const decisoes   = useAppStore((s) => s.decisoes)
  const municipios = useAppStore((s) => s.municipios)
  const qualidade  = useAppStore((s) => s.qualidade)
  const fonteDados = useAppStore((s) => s.fonteDados)
  const narrativa  = useAppStore((s) => s.narrativa)

  const nomes = useMemo(() => new Map(municipios.map((m) => [m.id_municipio, `${m.nome}/${m.uf}`])), [municipios])
  const noPlano = useMemo(() => new Set(portfolio.map((m) => m.id_municipio)), [portfolio])

  // `financeiro` só tem os municípios do escopo atual: as decisões do recorte são as desses municípios.
  const decididas = Object.values(decisoes).filter((d) => financeiro[d.id_municipio])
  const excecao = (d: Decisao) =>
    (d.decisao === 'aprovar' && !noPlano.has(d.id_municipio)) || (d.decisao === 'descartar' && noPlano.has(d.id_municipio))
  const pendentes = portfolio.filter((m) => !decisoes[m.id_municipio]).length

  const escopo = [filters.uf, filters.regiao, filters.semiarido ? 'Semiárido' : ''].filter(Boolean).join(' · ') || 'Brasil'
  const texto = narrativa?.chave === chaveNarrativa(portfolio.map((m) => m.id_municipio), budget, params, levers)
    ? narrativa.texto : null
  const limitados = qualidade.filter((q) => q.tipo !== 'real').map((q) => `${q.campo} (${q.tipo})`)

  return (
    <div className="print-dossie" aria-hidden="true">
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--ac)' }}>
        <img src={logo} alt="Conecta+" style={{ height: 44 }} />
        <h1 style={{ fontSize: 18, margin: '8px 0 2px' }}>Dossiê do recorte: {escopo}</h1>
        <p style={{ margin: 0, fontSize: 11 }}>
          Gerado em {new Date().toLocaleString('pt-BR')} · dados {fonteDados === 'mock' ? 'DEMONSTRATIVOS (não valem como recomendação)' : 'reais (IBGE, INEP, Anatel)'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11 }}>
          Cenário: {descreveCenario({ budget, objetivo, levers, params })} · teto de payback {TETO_PAYBACK_ANOS} anos
        </p>
      </div>

      <h2 style={{ fontSize: 14 }}>Resumo do plano</h2>
      {kpis ? (
        <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
          <li>{fmtN0(kpis.countPortfolio)} municípios no plano · CapEx {fmtMi(kpis.capexUsado)} de R$ {budget} mi</li>
          <li>
            Payback médio {fmtAnos(kpis.paybackMedio)} · VPL total {fmtMi(kpis.vplTotal)}
            {kpis.semAlavancas ? ` (sem alavancas: payback ${fmtAnos(kpis.semAlavancas.paybackMedio)}, VPL ${fmtMi(kpis.semAlavancas.vplTotal)})` : ''}
          </li>
          <li>{fmtN0(kpis.alunosConectados)} alunos em {fmtN0(kpis.escolasAtendidas)} escolas sem internet para aprendizagem</li>
          <li>{pendentes ? `${pendentes} municípios do plano ainda sem decisão registrada` : 'Todos os municípios do plano têm decisão registrada'}</li>
        </ul>
      ) : <p style={{ fontSize: 12 }}>Portfólio não calculado (servidor indisponível).</p>}

      {texto && (
        <>
          <h2 style={{ fontSize: 14 }}>Leitura do plano (IA)</h2>
          <p style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{texto}</p>
        </>
      )}

      {decididas.length > 0 && (
        <>
          <h2 style={{ fontSize: 14 }}>Decisões registradas</h2>
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {decididas.map((d) => (
              <li key={d.id} style={{ marginBottom: 4 }}>
                <b>{nomes.get(d.id_municipio) ?? d.id_municipio}: {DECISOES[d.decisao].label}</b>
                {excecao(d) ? ' (exceção ao plano)' : ''} · {d.responsavel}, {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                <br />Motivo: {d.motivo}
                {d.observacao_campo ? <><br />Observação de campo: {d.observacao_campo}</> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {portfolio.length > 0 && (
        <>
          <h2 style={{ fontSize: 14 }}>Municípios do plano</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Município</th><th style={th}>Quadrante</th>
                <th style={{ ...th, textAlign: 'right' }}>CapEx</th><th style={{ ...th, textAlign: 'right' }}>Payback</th>
                <th style={{ ...th, textAlign: 'right' }}>VPL</th><th style={{ ...th, textAlign: 'right' }}>Alunos s/ internet</th>
                <th style={th}>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((m) => {
                const f = financeiro[m.id_municipio]
                const d = decisoes[m.id_municipio]
                return (
                  <tr key={m.id_municipio}>
                    <td style={td}>{m.nome}/{m.uf}</td>
                    <td style={td}>{m.quadrante}</td>
                    <td style={num}>{fmtMi(f?.capex)}</td>
                    <td style={num}>{fmtAnos(f?.payback)}</td>
                    <td style={num}>{fmtMi(f?.npv)}</td>
                    <td style={num}>{fmtN0(m.alunos_sem_internet)}</td>
                    <td style={td}>{d ? DECISOES[d.decisao].label : 'Pendente'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ fontSize: 14 }}>Limites</h2>
      <p style={{ fontSize: 11, margin: 0 }}>
        O plano é uma priorização do modelo; a decisão é do gestor e está registrada acima com o motivo.
        Os números das decisões foram recalculados no servidor com o cenário de cada uma.
        {limitados.length > 0 ? ` Campos neutros ou aproximados no motor: ${limitados.join(', ')}.` : ''}
      </p>
    </div>
  )
}
