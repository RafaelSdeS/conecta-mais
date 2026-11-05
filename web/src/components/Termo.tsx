/**
 * Termo — explica um termo técnico ao toque ou clique, com o popover nativo do navegador.
 */

import { useId } from 'react'

const GLOSSARIO = {
  VPL: 'Valor presente líquido: quanto o projeto vale hoje somando o que entra e o que sai, descontado o custo do dinheiro. Negativo significa que não se paga nesse critério.',
  CapEx: 'Investimento inicial para construir a rede: rede de acesso, instalação e ligação à fibra de transporte.',
  Payback: 'Tempo para o resultado anual recuperar o investimento, sem considerar o custo do dinheiro.',
  Backhaul: 'Fibra de transporte que liga o município à rede principal da operadora.',
} as const

export default function Termo({ nome }: { nome: keyof typeof GLOSSARIO }) {
  const id = useId()
  return (
    <>
      {nome}{' '}
      <button
        type="button"
        className="no-print"
        popoverTarget={id}
        aria-label={`O que é ${nome}?`}
        style={{ font: 'inherit', fontSize: 11, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--ln)', background: 'transparent', color: 'var(--mu)', cursor: 'pointer', padding: 0 }}
      >
        ?
      </button>
      <span id={id} popover="auto" style={{ margin: 'auto', maxWidth: 300, padding: 12, borderRadius: 6, border: '1px solid var(--ln)', background: 'var(--pn)', color: 'var(--tx)', fontSize: 14, fontWeight: 400 }}>
        {GLOSSARIO[nome]}
      </span>
    </>
  )
}
