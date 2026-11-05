/**
 * CampoView — entrada do app para o gestor regional no celular: achar o município (busca ou localização),
 * ver as prioridades da região e a própria carteira. Cada cartão abre a ficha com o veredito.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Municipio } from '../api/client'
import { useFavorites } from '../hooks/useFavorites'
import { ROTULO_DECISAO, useRecomendacoes } from '../hooks/useRecomendacoes'
import { useAppStore } from '../store/appStore'
import { UFS } from '../utils/constants'
import { baixaCsv, paraCsv } from '../utils/csv'
import { salvaUf, semAcento } from '../utils/filtros'
import { fmtAnos, fmtMi, fmtN0 } from '../utils/format'
import { maisProximos, type Ponto } from '../utils/proximidade'
import { COR_VEREDITO, priorizar, veredito } from '../utils/veredito'

const RAIO_KM = 150
const LIMITE_LISTA = 20

const campo: React.CSSProperties = {
  font: 'inherit',
  fontSize: 16, // abaixo disso o iPhone dá zoom ao focar
  minHeight: 44,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--ln)',
  background: 'var(--pn)',
  color: 'var(--tx)',
}

function Cartao({ m, km }: { m: Municipio; km?: number }) {
  const fin = useAppStore((s) => s.financeiro[m.id_municipio])
  const openDrawer = useAppStore((s) => s.openDrawer)
  const recomendacao = useRecomendacoes()[m.id_municipio]
  const v = veredito(m, fin)
  // Muitos municípios têm o mesmo retorno (piso do modelo); o investimento é o que os diferencia.
  const financeiro = fin ? `${fmtMi(fin.capex)} · retorno em ${fmtAnos(fin.payback)}` : null
  return (
    <button
      type="button"
      onClick={() => openDrawer(m.id_municipio)}
      style={{
        font: 'inherit',
        display: 'block',
        width: '100%',
        minHeight: 44,
        textAlign: 'left',
        padding: '10px 12px',
        marginBottom: 8,
        borderRadius: 6,
        cursor: 'pointer',
        color: 'var(--tx)',
        background: 'var(--pn)',
        border: '1px solid var(--ln)',
        borderLeft: `6px solid ${COR_VEREDITO[v.nivel]}`,
      }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b>{m.nome} / {m.uf}</b>
        {km != null && <span style={{ color: 'var(--mu)', fontSize: 13, whiteSpace: 'nowrap' }}>{km.toFixed(0)} km</span>}
      </span>
      <span style={{ display: 'block', fontWeight: 600, fontSize: 14, marginTop: 2 }}>{v.titulo}</span>
      {recomendacao && (
        <span style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
          Sua recomendação: <b>{ROTULO_DECISAO[recomendacao.decisao]}</b>{recomendacao.nota && ` · ${recomendacao.nota}`}
        </span>
      )}
      <span style={{ display: 'block', color: 'var(--mu)', fontSize: 13, marginTop: 2 }}>
        {[financeiro, `${fmtN0(m.alunos_sem_internet)} alunos sem internet`].filter(Boolean).join(' · ')}
      </span>
    </button>
  )
}

export default function CampoView() {
  const municipios = useAppStore((s) => s.municipios)
  const financeiro = useAppStore((s) => s.financeiro)
  const filters    = useAppStore((s) => s.filters)
  const setFilters = useAppStore((s) => s.setFilters)
  const setView    = useAppStore((s) => s.setView)
  const [favs]     = useFavorites()
  const recomendacoes = useRecomendacoes()

  const [busca, setBusca]   = useState('')
  const [origem, setOrigem] = useState<Ponto | null>(null)
  const [localizando, setLocalizando] = useState(false)
  const [erroLocal, setErroLocal]     = useState<string>()

  // Aqui só a UF filtra: os outros filtros do Painel deixariam municípios sem retorno calculado.
  useEffect(() => {
    setFilters({ search: '', regiao: '', semiarido: false, quadrante: '', portfolioOnly: false, favoritesOnly: false })
  }, [setFilters])

  const resultados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return termo.length < 2 ? [] : municipios.filter((m) => semAcento(m.nome).includes(termo)).slice(0, 8)
  }, [busca, municipios])

  const proximos = useMemo(() => (origem ? maisProximos(municipios, origem, 500) : []), [origem, municipios])
  const kmPorId = useMemo(() => new Map(proximos.map((p) => [p.item.id_municipio, p.km])), [proximos])

  const prioridades = useMemo(() => {
    const regiao = origem
      ? proximos.filter((p) => p.km <= RAIO_KM).map((p) => p.item)
      : municipios.filter((m) => !filters.uf || m.uf === filters.uf)
    return priorizar(regiao, financeiro).slice(0, LIMITE_LISTA)
  }, [origem, proximos, municipios, filters.uf, financeiro])

  const carteira = useMemo(
    () => municipios.filter((m) => favs.has(m.id_municipio) || recomendacoes[m.id_municipio]),
    [municipios, favs, recomendacoes],
  )

  function exportaCarteira() {
    const linhas = carteira.map((m) => {
      const fin = financeiro[m.id_municipio]
      const rec = recomendacoes[m.id_municipio]
      return {
        municipio: m.nome,
        uf: m.uf,
        veredito: veredito(m, fin).titulo,
        recomendacao: rec ? ROTULO_DECISAO[rec.decisao] : '',
        observacao: rec?.nota ?? '',
        data: rec ? new Date(rec.data).toLocaleDateString('pt-BR') : '',
        investimento_mi: fin?.capex.toFixed(2) ?? '',
        retorno_anos: fin?.payback?.toFixed(1) ?? '',
        vpl_mi: fin?.npv.toFixed(2) ?? '',
        alunos_sem_internet: m.alunos_sem_internet,
      }
    })
    baixaCsv('carteira-conecta.csv', paraCsv(linhas, [
      { chave: 'municipio', titulo: 'Município' },
      { chave: 'uf', titulo: 'UF' },
      { chave: 'veredito', titulo: 'Veredito' },
      { chave: 'recomendacao', titulo: 'Recomendação' },
      { chave: 'observacao', titulo: 'Observação' },
      { chave: 'data', titulo: 'Data' },
      { chave: 'investimento_mi', titulo: 'Investimento (R$ mi)' },
      { chave: 'retorno_anos', titulo: 'Retorno (anos)' },
      { chave: 'vpl_mi', titulo: 'VPL (R$ mi)' },
      { chave: 'alunos_sem_internet', titulo: 'Alunos sem internet' },
    ]))
  }

  function pertoDeMim() {
    if (!navigator.geolocation) {
      setErroLocal('Este navegador não informa a localização. Busque o município pelo nome.')
      return
    }
    setLocalizando(true)
    setErroLocal(undefined)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigem({ lat: coords.latitude, lon: coords.longitude })
        setFilters({ uf: '' }) // o raio pode cruzar a divisa do estado
        setLocalizando(false)
      },
      () => {
        setErroLocal('Não foi possível obter sua localização. Busque o município pelo nome ou escolha o estado.')
        setLocalizando(false)
      },
      { timeout: 10_000, maximumAge: 300_000 },
    )
  }

  function escolheUf(uf: string) {
    setOrigem(null)
    setFilters({ uf })
    salvaUf(uf)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px' }}>Vale levar adiante?</h1>
      <p style={{ margin: '0 0 12px', color: 'var(--mu)' }}>Busque um município ou use sua localização.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome do município"
          aria-label="Buscar município"
          style={{ ...campo, flex: '1 1 200px', minWidth: 0 }}
        />
        <button type="button" onClick={pertoDeMim} disabled={localizando} style={{ ...campo, cursor: 'pointer', fontWeight: 600 }}>
          {localizando ? 'Localizando…' : 'Perto de mim'}
        </button>
      </div>
      {erroLocal && <p role="alert" style={{ color: 'var(--q2b)', margin: '0 0 8px', fontSize: 14 }}>{erroLocal}</p>}

      {busca.trim().length >= 2 && (
        <section aria-label="Resultado da busca" style={{ marginBottom: 16 }}>
          {resultados.length === 0 && <p style={{ color: 'var(--mu)' }}>Nenhum município com esse nome.</p>}
          {resultados.map((m) => <Cartao key={m.id_municipio} m={m} km={kmPorId.get(m.id_municipio)} />)}
        </section>
      )}

      {origem && (
        <section style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: '8px 0' }}>Você está perto de</h2>
          {proximos.slice(0, 3).map((p) => <Cartao key={p.item.id_municipio} m={p.item} km={p.km} />)}
        </section>
      )}

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>
            {origem ? `Prioridades em até ${RAIO_KM} km` : `Prioridades em ${filters.uf || 'todo o Brasil'}`}
          </h2>
          <select value={origem ? '' : filters.uf} onChange={(e) => escolheUf(e.target.value)} aria-label="Estado" style={campo}>
            <option value="">Todo o Brasil</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        {prioridades.length === 0 && <p style={{ color: 'var(--mu)' }}>Nenhum município priorizado nesta região.</p>}
        {prioridades.map((m) => <Cartao key={m.id_municipio} m={m} km={kmPorId.get(m.id_municipio)} />)}
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, margin: '8px 0' }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Minha carteira</h2>
          {carteira.length > 0 && (
            <button type="button" onClick={exportaCarteira} style={{ ...campo, fontSize: 14, cursor: 'pointer' }}>Exportar CSV</button>
          )}
        </div>
        {carteira.length === 0 && (
          <p style={{ color: 'var(--mu)', margin: 0 }}>Na ficha de um município, favorite ou registre uma recomendação para acompanhá-lo aqui.</p>
        )}
        {carteira.map((m) => <Cartao key={m.id_municipio} m={m} km={kmPorId.get(m.id_municipio)} />)}
      </section>

      <button
        type="button"
        onClick={() => setView('painel')}
        style={{ font: 'inherit', minHeight: 44, background: 'none', border: 0, color: 'var(--ac)', cursor: 'pointer', padding: 0 }}
      >
        Ajustar cenário e premissas no Painel
      </button>
    </div>
  )
}
