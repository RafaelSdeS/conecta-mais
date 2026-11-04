/**
 * RegionChips — filtro de região sobre o mapa (uma região por vez).
 * Usa o mesmo estado do filtro "região" do FilterBar: tabela, KPIs, portfólio e chat respondem junto.
 * A contagem de cada chip ignora o próprio filtro de região, para mostrar quanto há em cada uma.
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useFilteredMunicipios } from '../hooks/useFilteredMunicipios'
import { REGIOES, regiaoDe } from '../utils/regioes'
import { fmtN0 } from '../utils/format'

export default function RegionChips() {
  const regiao     = useAppStore((s) => s.filters.regiao)
  const uf         = useAppStore((s) => s.filters.uf)
  const setFilters = useAppStore((s) => s.setFilters)
  const doRecorte  = useFilteredMunicipios('regiao')

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}
    doRecorte.forEach((m) => {
      const r = regiaoDe(m.id_municipio)
      if (r) c[r] = (c[r] ?? 0) + 1
    })
    return c
  }, [doRecorte])

  // Trocar de região limpa a UF: uma UF de outra região deixaria o recorte vazio.
  const escolhe = (r: string) => setFilters({ regiao: r === regiao ? '' : r, uf: '' })

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    cursor: 'pointer',
    color: ativo ? 'var(--on)' : 'var(--tx)',
    background: ativo ? 'var(--ac)' : 'var(--pn)',
    border: `1px solid ${ativo ? 'var(--ac)' : 'var(--ln)'}`,
  })

  return (
    <div
      role="radiogroup"
      aria-label="Filtrar mapa por região"
      style={{
        position: 'absolute',
        top: 10,
        left: 54, // ao lado dos controles de zoom
        right: 10,
        zIndex: 500,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        pointerEvents: 'none', // só os chips capturam cliques; o mapa continua arrastável entre eles
      }}
    >
      {[{ nome: '', rotulo: 'Brasil', n: doRecorte.length }, ...REGIOES.map((r) => ({ nome: r, rotulo: r, n: contagem[r] ?? 0 }))].map(
        ({ nome, rotulo, n }) => {
          const ativo = nome ? regiao === nome : !regiao && !uf
          return (
            <button
              key={rotulo}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => (nome ? escolhe(nome) : setFilters({ regiao: '', uf: '' }))}
              style={{ ...chip(ativo), pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}
            >
              {rotulo}
              <span style={{ opacity: ativo ? 0.9 : 0.65 }}>{fmtN0(n)}</span>
            </button>
          )
        },
      )}
    </div>
  )
}
