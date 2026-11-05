/**
 * DecisaoCard — o que o gestor em campo precisa ler primeiro: veredito, motivos, limites e próximos passos.
 */

import type { Municipio } from '../api/client'
import { useAppStore } from '../store/appStore'
import {
  alertaFinanceiro, limitesDados, motivos, veredito, type FinanceiroVeredito, type NivelVeredito,
} from '../utils/veredito'

const COR: Record<NivelVeredito, string> = {
  avancar: 'var(--q1)',
  condicao: 'var(--q2b)',
  nao: 'var(--q4)',
  pendente: 'var(--ln)',
}

export default function DecisaoCard({ m, fin }: { m: Municipio; fin?: FinanceiroVeredito }) {
  const qualidade = useAppStore((s) => s.qualidade)
  const v = veredito(m, fin)
  const alerta = alertaFinanceiro(fin)
  const limites = limitesDados(qualidade)

  return (
    <section
      aria-label="Recomendação do Conecta+"
      style={{
        border: '1px solid var(--ln)',
        borderLeft: `6px solid ${COR[v.nivel]}`,
        borderRadius: 6,
        padding: 14,
        margin: '10px 0 12px',
        background: 'var(--pn)',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{v.titulo}</div>
      {v.explicacao && <p style={{ margin: '6px 0 0', fontSize: 14 }}>{v.explicacao}</p>}

      <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14 }}>
        {motivos(m, fin).map((motivo) => <li key={motivo}>{motivo}</li>)}
      </ul>

      {alerta && (
        <p role="note" style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: 4, fontSize: 13, background: 'rgba(217, 130, 43, .12)' }}>
          {alerta}
        </p>
      )}

      {v.proximosPassos.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Próximos passos</div>
          <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 14 }}>
            {v.proximosPassos.map((passo) => <li key={passo}>{passo}</li>)}
          </ol>
        </>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--mu)' }}>
        Indica se vale levar adiante; não é aprovação de investimento. As premissas financeiras são médias nacionais.
        {limites && ` ${limites}`}
      </p>
    </section>
  )
}
