/**
 * RegistroRecomendacao — o gestor grava o que recomenda e o que viu na visita; o município entra na carteira.
 */

import { useState } from 'react'
import { ROTULO_DECISAO, salvaRecomendacao, useRecomendacoes, type Decisao } from '../hooks/useRecomendacoes'

const DECISOES = Object.keys(ROTULO_DECISAO) as Decisao[]

export default function RegistroRecomendacao({ id }: { id: string }) {
  const atual = useRecomendacoes()[id]
  const [nota, setNota] = useState(atual?.nota ?? '')

  return (
    <section className="no-print" aria-label="Registrar recomendação" style={{ margin: '12px 0' }}>
      <h3 style={{ marginTop: 0 }}>Sua recomendação</h3>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="O que você viu na visita? (opcional)"
        aria-label="Observação da visita"
        rows={2}
        style={{ font: 'inherit', fontSize: 16, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--ln)', background: 'var(--pn)', color: 'var(--tx)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
        {DECISOES.map((decisao) => {
          const ativa = atual?.decisao === decisao
          return (
            <button
              key={decisao}
              type="button"
              aria-pressed={ativa}
              onClick={() => salvaRecomendacao(id, decisao, nota)}
              style={{
                font: 'inherit',
                fontSize: 14,
                minHeight: 44,
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: ativa ? 700 : 500,
                color: ativa ? 'var(--on)' : 'var(--tx)',
                background: ativa ? 'var(--ac)' : 'transparent',
                border: '1px solid var(--ac)',
              }}
            >
              {ROTULO_DECISAO[decisao]}
            </button>
          )
        })}
      </div>
      {atual && (
        <p role="status" style={{ fontSize: 12, color: 'var(--mu)', margin: '6px 0 0' }}>
          Registrado em {new Date(atual.data).toLocaleString('pt-BR')}. Fica salvo só neste aparelho; exporte pela carteira.
        </p>
      )}
    </section>
  )
}
