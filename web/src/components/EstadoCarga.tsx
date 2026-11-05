/**
 * EstadoCarga — o que aparece enquanto os municípios não chegam, no lugar de telas zeradas.
 */

export default function EstadoCarga({ erro }: { erro: string | null }) {
  if (!erro) return <p role="status">Carregando municípios…</p>
  return (
    <div role="alert">
      <p>Não foi possível carregar os municípios. Verifique a conexão.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ font: 'inherit', minHeight: 44, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ln)', background: 'var(--pn)', color: 'var(--tx)' }}
      >
        Tentar de novo
      </button>
    </div>
  )
}
