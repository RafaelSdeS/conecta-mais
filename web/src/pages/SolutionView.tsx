/**
 * SolutionView — a solução como ela é hoje: números da base real, panorama por região, fluxo dos
 * dados até o agente Granite (com status), composição dos scores, qualidade das fontes e roadmap.
 * ROI e mercado vêm da proposta e o backtest é demonstrativo; ambos estão rotulados como tal.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  FLUXO,
  FONTES_CAMPOS,
  MERCADO_KPIS,
  PESOS_SCORE,
  RISCOS,
  ROADMAP,
  ROI_ROWS,
  type StatusEntrega,
} from '../utils/constants'
import { useAppStore } from '../store/appStore'
import { api, type BacktestResult, type CampoQualidade } from '../api/client'
import { resumoGeral, resumoPorRegiao } from '../utils/resumo'
import { fmtN0 } from '../utils/format'
import logoIcone       from '../assets/logo.svg'
import logoIconeBranca from '../assets/logo-branca.svg'

const pn: React.CSSProperties = {
  background: 'var(--pn)',
  border: '1px solid var(--ln)',
  borderRadius: 6,
  padding: 16,
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ln)',
  fontWeight: 500, fontSize: 12, color: 'var(--mu)', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '7px 8px', borderBottom: '1px solid var(--ln)', fontSize: 13 }
const num: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

const COR_STATUS: Record<StatusEntrega | 'proximo', string> = {
  entregue: 'var(--ok)', parcial: 'var(--q3)', planejado: 'var(--mu)', proximo: 'var(--q2a)',
}
const ROTULO_STATUS: Record<StatusEntrega | 'proximo', string> = {
  entregue: 'Entregue', parcial: 'Parcial', planejado: 'Planejado', proximo: 'Próximo',
}

function Selo({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span style={{
      fontSize: 11, border: `1px solid ${cor}`, color: cor, borderRadius: 999,
      padding: '1px 8px', whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  )
}

/** Estado de um componente do score a partir dos campos que ele usa. */
function estadoComponente(campos: string[], q: Map<string, CampoQualidade['tipo']>) {
  if (q.size === 0) return null
  const tipos = campos.map((c) => q.get(c) ?? 'real')
  if (tipos.every((t) => t === 'neutro')) return 'neutro'
  if (tipos.some((t) => t === 'neutro')) return 'parcial'
  if (tipos.some((t) => t === 'aproximado')) return 'aproximado'
  return 'real'
}

const COR_ESTADO: Record<string, string> = {
  real: 'var(--ok)', aproximado: 'var(--q3)', parcial: 'var(--q3)', neutro: 'var(--q2b)',
}

function Secao({ titulo, children, aberta = false }: { titulo: string; children: React.ReactNode; aberta?: boolean }) {
  return (
    <details open={aberta} style={{ ...pn, marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 600 }}>{titulo}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  )
}

export default function SolutionView() {
  const theme        = useAppStore((s) => s.theme)
  const municipios   = useAppStore((s) => s.municipios)
  const portfolio    = useAppStore((s) => s.portfolio)
  const qualidade    = useAppStore((s) => s.qualidade)
  const fonteDados   = useAppStore((s) => s.fonteDados)
  const apiOffline   = useAppStore((s) => s.apiOffline)
  const setFilters   = useAppStore((s) => s.setFilters)
  const setView      = useAppStore((s) => s.setView)

  const portfolioIds = useMemo(() => new Set(portfolio.map((m) => m.id_municipio)), [portfolio])
  const geral        = useMemo(() => resumoGeral(municipios, portfolioIds), [municipios, portfolioIds])
  const regioes      = useMemo(() => resumoPorRegiao(municipios, portfolioIds), [municipios, portfolioIds])
  const tipoPorCampo = useMemo(() => new Map(qualidade.map((c) => [c.campo, c.tipo])), [qualidade])
  const covPorCampo  = useMemo(() => new Map(qualidade.map((c) => [c.campo, c.cobertura])), [qualidade])

  // ── Backtest ───────────────────────────────────────────────────────────────
  const [backtest, setBacktest]         = useState<BacktestResult | null>(null)
  const [backtestLoading, setBtLoading] = useState(false)
  const [backtestError, setBtError]     = useState<string | null>(null)

  useEffect(() => {
    setBtLoading(true)
    api.getBacktest()
      .then(setBacktest)
      .catch((e: unknown) => setBtError(String(e)))
      .finally(() => setBtLoading(false))
  }, [])

  const temDados = municipios.length > 0
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(0)}%` : '—')

  const kpis = [
    { label: 'Municípios analisados', value: fmtN0(geral.municipios), detail: `${fmtN0(geral.q1q2a)} em Q1 ou Q2a` },
    { label: 'Escolas sem internet', value: fmtN0(geral.escolasSemInternet), detail: `${pct(geral.escolasSemInternet, geral.escolas)} das ${fmtN0(geral.escolas)} escolas públicas (para aprendizagem)` },
    { label: 'Alunos nessas escolas', value: fmtN0(geral.alunosSemInternet), detail: 'matrículas em escolas sem internet' },
    { label: 'Com backhaul de fibra', value: fmtN0(geral.comBackhaul), detail: `${pct(geral.comBackhaul, geral.municipios)} dos municípios (Anatel)` },
    { label: 'No Semiárido', value: fmtN0(geral.semiarido), detail: 'municípios (IBGE/SUDENE 2022)' },
  ]

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src={theme === 'dark' ? logoIconeBranca : logoIcone}
          alt=""
          aria-hidden="true"
          style={{ width: 40, height: 40, flexShrink: 0 }}
        />
        <div>
          <h1>Solução</h1>
          <p style={{ color: 'var(--mu)' }}>
            O que o Conecta+ faz hoje: dados reais, motor de decisão e agente de IA, com o estado de cada parte.
          </p>
        </div>
      </div>

      {/* Estado da base */}
      <div role="status" style={{ ...pn, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {apiOffline ? (
          <>
            <Selo cor="var(--q2b)" texto="API offline" />
            <span style={{ fontSize: 13 }}>Sem conexão com a API: os números abaixo não estão disponíveis.</span>
          </>
        ) : fonteDados === 'mock' ? (
          <>
            <Selo cor="var(--q2b)" texto="Dados demonstrativos" />
            <span style={{ fontSize: 13 }}>A API não encontrou o banco real; rode o ETL e confira CONECTA_SQLITE_PATH.</span>
          </>
        ) : (
          <>
            <Selo cor="var(--ok)" texto="Base real" />
            <span style={{ fontSize: 13 }}>
              Dados do IBGE, INEP e Anatel integrados pelo ETL. Campos sem fonte pública aparecem como neutros ou aproximados.
            </span>
          </>
        )}
      </div>

      {/* KPIs ao vivo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={pn}>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3, margin: '4px 0' }}>{temDados ? k.value : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>{temDados ? k.detail : 'aguardando a API'}</div>
          </div>
        ))}
      </div>

      {/* Panorama por região */}
      <div style={{ ...pn, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 4 }}>Panorama por região</h2>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8 }}>
          Clique numa região para abrir o Painel já filtrado por ela.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Região</th>
                <th style={{ ...th, ...num }}>Municípios</th>
                <th style={{ ...th, ...num }}>Escolas sem internet</th>
                <th style={{ ...th, ...num }}>Alunos sem internet</th>
                <th style={{ ...th, ...num }}>Com backhaul</th>
                <th style={{ ...th, ...num }}>Q1 + Q2a</th>
                <th style={{ ...th, ...num }}>No portfólio</th>
              </tr>
            </thead>
            <tbody>
              {regioes.map(({ regiao, resumo: r }) => (
                <tr
                  key={regiao}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setFilters({ regiao, uf: '' }); setView('painel') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setFilters({ regiao, uf: '' }); setView('painel') } }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...td, fontWeight: 500 }}>{regiao}</td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.municipios)}</td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.escolasSemInternet)} <span style={{ color: 'var(--mu)' }}>({pct(r.escolasSemInternet, r.escolas)})</span></td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.alunosSemInternet)}</td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.comBackhaul)}</td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.q1q2a)}</td>
                  <td style={{ ...td, ...num }}>{fmtN0(r.noPortfolio)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Brasil</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.municipios)}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.escolasSemInternet)}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.alunosSemInternet)}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.comBackhaul)}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.q1q2a)}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtN0(geral.noPortfolio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Como funciona */}
      <Secao titulo="Como funciona: da fonte ao agente" aberta>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, alignItems: 'start' }}>
          {FLUXO.map((coluna, i) => (
            <div key={coluna.titulo}>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {i + 1}. {coluna.titulo}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {coluna.itens.map((item) => (
                  <div key={item.nome} style={{ border: '1px solid var(--ln)', borderRadius: 6, padding: '8px 10px', borderLeft: `3px solid ${COR_STATUS[item.status]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                      <b style={{ fontSize: 13 }}>{item.nome}</b>
                      <Selo cor={COR_STATUS[item.status]} texto={ROTULO_STATUS[item.status]} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 4 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      {/* Composição dos scores */}
      <Secao titulo="Como os scores são compostos">
        <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>
          Pesos reais do motor. O selo mostra se o dado do componente é real, aproximado ou neutro (igual para todos os municípios, sem poder de diferenciação).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {PESOS_SCORE.map((s) => {
            const semDados = s.componentes
              .filter((c) => estadoComponente(c.campos, tipoPorCampo) === 'neutro')
              .reduce((acc, c) => acc + c.peso, 0)
            return (
              <div key={s.score} style={{ border: '1px solid var(--ln)', borderRadius: 6, padding: 12 }}>
                <b>{s.score} · {s.titulo}</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                  <tbody>
                    {s.componentes.map((c) => {
                      const estado = estadoComponente(c.campos, tipoPorCampo)
                      return (
                        <tr key={c.nome}>
                          <td style={{ ...td, padding: '4px 0' }}>{c.nome}</td>
                          <td style={{ ...td, padding: '4px 6px', ...num }}>{c.peso}%</td>
                          <td style={{ ...td, padding: '4px 0', ...num }}>
                            {estado && estado !== 'real' && <Selo cor={COR_ESTADO[estado]} texto={estado} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {tipoPorCampo.size > 0 && (
                  <p style={{ fontSize: 12, margin: '8px 0 0', color: semDados > 0 ? 'var(--q2b)' : 'var(--mu)' }}>
                    {semDados > 0 ? `${semDados}% do peso depende de dado neutro.` : 'Todos os componentes têm dado real ou aproximado.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Secao>

      {/* Qualidade das fontes */}
      <Secao titulo="Fontes e qualidade dos dados">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Campo</th>
                <th style={th}>Fonte</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, ...num }}>Cobertura</th>
                <th style={th}>Como melhorar</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FONTES_CAMPOS).map(([campo, meta]) => {
                const estado = tipoPorCampo.get(campo)
                const cob = covPorCampo.get(campo)
                return (
                  <tr key={campo}>
                    <td style={td}>{meta.rotulo}</td>
                    <td style={{ ...td, color: 'var(--mu)' }}>{meta.fonte}</td>
                    <td style={td}>{estado ? <Selo cor={COR_ESTADO[estado]} texto={estado} /> : '—'}</td>
                    <td style={{ ...td, ...num }}>{cob === undefined ? '—' : `${(cob * 100).toFixed(0)}%`}</td>
                    <td style={{ ...td, color: 'var(--mu)' }}>{meta.melhoria}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 8 }}>
          Cobertura = parcela dos municípios com valor diferente do mais comum; para campos neutros é 0%.
        </p>
      </Secao>

      {/* Roadmap */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        {ROADMAP.map((fase) => (
          <div key={fase.titulo} style={{ ...pn, borderTop: `3px solid ${COR_STATUS[fase.status]}` }}>
            <h2 style={{ marginBottom: 8 }}>{fase.titulo}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {fase.itens.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Riscos */}
      <div style={{ ...pn, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Limites e riscos conhecidos</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {RISCOS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      {/* Mercado e ROI (proposta) */}
      <div style={{ ...pn, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Mercado e ROI estimado para a Vivo</h2>
          <Selo cor="var(--q3)" texto="Estimativa da proposta" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>
          Hipóteses a validar (docs/PROPOSTA_DETALHADA.md, §7). Não são calculadas pelo app.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {MERCADO_KPIS.map((k) => (
            <div key={k.label} style={{ border: '1px solid var(--ln)', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>{k.detail}</div>
            </div>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Vetor de ganho</th><th style={{ ...th, ...num }}>Impacto anual</th></tr>
          </thead>
          <tbody>
            {ROI_ROWS.map((row) => (
              <tr key={row.label}>
                <td style={td}>{row.highlight ? <b>{row.label}</b> : row.label}</td>
                <td style={{ ...td, ...num, fontWeight: row.highlight ? 600 : 400, color: row.highlight ? 'var(--ok)' : 'inherit' }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 10 }}>
          Custos: R$ 4,5 mi no ano 1 e R$ 2,5 mi/ano depois. Payback da ferramenta em menos de 2 meses após o primeiro ciclo trimestral.
        </p>
      </div>

      {/* Backtest */}
      <div style={pn}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Backtest 2021 → 2025</h2>
          <Selo cor="var(--q2b)" texto={backtest?.fonte === 'real' ? 'Dados reais' : 'Demonstrativo'} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 12 }}>
          Dos municípios classificados como Q1/Q2a em 2021, quantos expandiram a base de fibra até 2025.
          {backtest?.fonte !== 'real' && ' O cálculo usa 49 municípios de demonstração: não há histórico de 2021 em fonte aberta, então estes números ilustram o método e não validam o modelo.'}
        </p>

        {backtestLoading && <p style={{ fontSize: 13, color: 'var(--mu)' }}>Carregando…</p>}
        {backtestError && !backtestLoading && (
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>API offline — resultado de backtest indisponível.</p>
        )}
        {backtest && !backtestLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Precision',              value: `${(backtest.precision * 100).toFixed(0)}%`,   detail: 'dos Q1/Q2a que realmente cresceram' },
              { label: 'Recall',                 value: `${(backtest.recall * 100).toFixed(0)}%`,      detail: 'dos que cresceram que eram Q1/Q2a' },
              { label: 'F1-Score',               value: backtest.f1.toFixed(2),                        detail: 'média harmônica precision/recall' },
              { label: 'Municípios Q1/Q2a 2021', value: String(backtest.total_q1_q2a_2021),            detail: 'classificados pelo modelo' },
              { label: 'Cresceram em fibra',     value: String(backtest.total_cresceram),              detail: `threshold: +${((backtest.threshold_crescimento - 1) * 100).toFixed(0)}%` },
              { label: 'Acertos',                value: String(backtest.acertados),                    detail: 'Q1/Q2a que de fato cresceram' },
            ].map(({ label, value, detail }) => (
              <div key={label} style={{ ...pn, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
